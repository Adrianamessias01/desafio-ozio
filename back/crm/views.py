from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from . import services
from .models import Customer, Opportunity
from .serializers import (
    CustomerListSerializer,
    CustomerSerializer,
    OpportunityDetailSerializer,
    OpportunitySerializer,
    StageMoveSerializer,
    UserSummarySerializer,
)
from .stages import OPEN_STAGES, Stage


class OpportunityViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    Oportunidades do pipeline.

    Filtros da listagem: ?stage=estágio, ?customer=id do cliente, ?owner=id do vendedor,
    ?search=texto no título ou cliente, ?close_from= e ?close_to= (AAAA-MM-DD) sobre a
    previsão de fechamento.
    Exclusão serve para cadastros feitos por engano; negócio encerrado vai para Perdido.
    Oportunidade convertida em pedido não pode ser excluída.
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        queryset = Opportunity.objects.select_related("customer", "owner")
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("stage_changes__changed_by")
        if self.action != "list":
            return queryset

        params = self.request.query_params
        if stage := params.get("stage"):
            if stage not in Stage.values:
                raise ValidationError({"stage": f"Estágio inválido: {stage}."})
            queryset = queryset.filter(stage=stage)
        if customer := params.get("customer"):
            queryset = queryset.filter(customer_id=_positive_int(customer, "customer"))
        if owner := params.get("owner"):
            queryset = queryset.filter(owner_id=_positive_int(owner, "owner"))
        if search := params.get("search", "").strip():
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(customer__name__icontains=search)
            )
        if close_from := params.get("close_from"):
            queryset = queryset.filter(
                expected_close_date__gte=_iso_date(close_from, "close_from")
            )
        if close_to := params.get("close_to"):
            queryset = queryset.filter(expected_close_date__lte=_iso_date(close_to, "close_to"))
        return queryset

    def get_serializer_class(self):
        if self.action == "retrieve":
            return OpportunityDetailSerializer
        return OpportunitySerializer

    def perform_create(self, serializer):
        serializer.instance = services.create_opportunity(
            owner=self.request.user, **serializer.validated_data
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_opportunity(
            serializer.instance.pk, **serializer.validated_data
        )

    def perform_destroy(self, instance):
        services.delete_opportunity(instance.pk)

    @extend_schema(request=StageMoveSerializer, responses=OpportunityDetailSerializer)
    @action(detail=True, methods=["patch"])
    def stage(self, request, pk=None):
        opportunity = self.get_object()
        payload = StageMoveSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        opportunity = services.move_stage(
            opportunity.pk,
            target=payload.validated_data["stage"],
            user=request.user,
            lost_reason=payload.validated_data.get("lost_reason", ""),
        )
        return Response(OpportunityDetailSerializer(_reload(opportunity.pk)).data)

    @extend_schema(
        request=None,
        responses=inline_serializer(
            "ConversionResult",
            {
                "order_number": serializers.CharField(),
                "created": serializers.BooleanField(),
                "opportunity": OpportunityDetailSerializer(),
            },
        ),
    )
    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        """201 quando o pedido é criado agora; 200 quando a oportunidade já estava convertida."""
        opportunity = self.get_object()
        result = services.convert_opportunity(opportunity.pk)
        return Response(
            {
                "order_number": result.order_number,
                "created": result.created,
                "opportunity": OpportunityDetailSerializer(_reload(opportunity.pk)).data,
            },
            status=status.HTTP_201_CREATED if result.created else status.HTTP_200_OK,
        )


class CustomerViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Clientes. A listagem traz os totais do pipeline; o cadastro aceita CPF/CNPJ formatado.

    Ordenação: ?ordering=campo ou -campo (decrescente), com campo entre name, document,
    open_count, won_count e open_amount. Padrão: name.
    """

    ORDERING_FIELDS = {"name", "document", "open_count", "won_count", "open_amount"}

    def get_serializer_class(self):
        if self.action == "create":
            return CustomerSerializer
        return CustomerListSerializer

    def get_queryset(self):
        ordering = self.request.query_params.get("ordering", "name")
        if ordering.removeprefix("-") not in self.ORDERING_FIELDS:
            raise ValidationError({"ordering": f"Ordenação inválida: {ordering}."})

        open_filter = Q(opportunities__stage__in=OPEN_STAGES)
        # Consultas com GROUP BY ignoram o Meta.ordering, por isso o order_by explícito.
        # O nome desempata, para a ordem ser estável entre valores iguais.
        return Customer.objects.annotate(
            open_count=Count("opportunities", filter=open_filter),
            won_count=Count("opportunities", filter=Q(opportunities__stage=Stage.WON)),
            open_amount=Coalesce(
                Sum("opportunities__amount", filter=open_filter),
                Value(Decimal("0")),
                output_field=DecimalField(max_digits=16, decimal_places=2),
            ),
        ).order_by(ordering, "name")


@extend_schema(responses=UserSummarySerializer(many=True))
@api_view(["GET"])
def sellers(request):
    """Vendedores (usuários ativos que não são administradores), para filtros do pipeline."""
    users = (
        get_user_model()
        .objects.filter(is_active=True, is_superuser=False)
        .order_by("first_name", "username")
    )
    return Response(UserSummarySerializer(users, many=True).data)


def _positive_int(value: str, field: str) -> int:
    if not value.isdigit():
        raise ValidationError({field: "Informe um identificador numérico."})
    return int(value)


def _iso_date(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({field: "Use o formato AAAA-MM-DD."}) from None


def _reload(pk: int) -> Opportunity:
    return (
        Opportunity.objects.select_related("customer", "owner")
        .prefetch_related("stage_changes__changed_by")
        .get(pk=pk)
    )
