from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Customer, Opportunity, OpportunityStageChange
from .stages import Stage


class UserSummarySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ["id", "username", "name"]

    def get_name(self, user) -> str:
        return user.get_full_name() or user.username


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "document", "email", "phone"]


class CustomerListSerializer(CustomerSerializer):
    """Cliente com os totais do pipeline (campos anotados na queryset)."""

    open_count = serializers.IntegerField(read_only=True)
    won_count = serializers.IntegerField(read_only=True)
    open_amount = serializers.DecimalField(max_digits=16, decimal_places=2, read_only=True)

    class Meta(CustomerSerializer.Meta):
        fields = [*CustomerSerializer.Meta.fields, "open_count", "won_count", "open_amount"]


class StageChangeSerializer(serializers.ModelSerializer):
    changed_by = UserSummarySerializer(read_only=True)

    class Meta:
        model = OpportunityStageChange
        fields = ["from_stage", "to_stage", "changed_by", "changed_at"]


class OpportunitySerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    customer_id = serializers.PrimaryKeyRelatedField(
        source="customer", queryset=Customer.objects.all(), write_only=True
    )
    owner = UserSummarySerializer(read_only=True)
    stage_label = serializers.CharField(source="get_stage_display", read_only=True)
    is_converted = serializers.BooleanField(read_only=True)

    class Meta:
        model = Opportunity
        fields = [
            "id",
            "title",
            "customer",
            "customer_id",
            "owner",
            "amount",
            "stage",
            "stage_label",
            "expected_close_date",
            "lost_reason",
            "erp_order_number",
            "converted_at",
            "is_converted",
            "created_at",
            "updated_at",
        ]
        # Estágio e motivo da perda só mudam pela rota /stage/, que aplica as regras.
        read_only_fields = [
            "stage",
            "lost_reason",
            "erp_order_number",
            "converted_at",
            "created_at",
            "updated_at",
        ]


class OpportunityDetailSerializer(OpportunitySerializer):
    stage_changes = StageChangeSerializer(many=True, read_only=True)

    class Meta(OpportunitySerializer.Meta):
        fields = [*OpportunitySerializer.Meta.fields, "stage_changes"]


class StageMoveSerializer(serializers.Serializer):
    stage = serializers.ChoiceField(choices=Stage.choices)
    lost_reason = serializers.CharField(required=False, allow_blank=True, max_length=1000)
