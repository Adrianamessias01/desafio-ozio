from decimal import Decimal

from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from . import services
from .models import Customer, Opportunity
from .serializers import (
    CustomerListSerializer,
    OpportunityDetailSerializer,
    OpportunitySerializer,
    StageMoveSerializer,
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

    Filtros: ?stage=estágio, ?customer=id do cliente, ?search=texto no título ou cliente.
    Exclusão serve para cadastros feitos por engano; negócio encerrado vai para Perdido.
    Oportunidade convertida em pedido não pode ser excluída.
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        queryset = Opportunity.objects.select_related("customer", "owner")
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("stage_changes__changed_by")

        params = self.request.query_params
        if stage := params.get("stage"):
            if stage not in Stage.values:
                raise ValidationError({"stage": f"Estágio inválido: {stage}."})
            queryset = queryset.filter(stage=stage)
        if customer := params.get("customer"):
            queryset = queryset.filter(customer_id=customer)
        if search := params.get("search", "").strip():
            queryset = queryset.filter(
                Q(title__icontains=search) | Q(customer__name__icontains=search)
            )
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


class CustomerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CustomerListSerializer

    def get_queryset(self):
        open_filter = Q(opportunities__stage__in=OPEN_STAGES)
        # Consultas com GROUP BY ignoram o Meta.ordering, por isso o order_by explícito.
        return Customer.objects.order_by("name").annotate(
            open_count=Count("opportunities", filter=open_filter),
            won_count=Count("opportunities", filter=Q(opportunities__stage=Stage.WON)),
            open_amount=Coalesce(
                Sum("opportunities__amount", filter=open_filter),
                Value(Decimal("0")),
                output_field=DecimalField(max_digits=16, decimal_places=2),
            ),
        )


def _reload(pk: int) -> Opportunity:
    return (
        Opportunity.objects.select_related("customer", "owner")
        .prefetch_related("stage_changes__changed_by")
        .get(pk=pk)
    )
