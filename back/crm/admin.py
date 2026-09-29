from django.contrib import admin

from .models import Customer, Opportunity, OpportunityStageChange


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "document", "email", "phone"]
    search_fields = ["name", "document", "email"]


class OpportunityStageChangeInline(admin.TabularInline):
    model = OpportunityStageChange
    extra = 0
    can_delete = False
    readonly_fields = ["from_stage", "to_stage", "changed_by", "changed_at"]

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Opportunity)
class OpportunityAdmin(admin.ModelAdmin):
    list_display = ["title", "customer", "owner", "amount", "stage", "erp_order_number"]
    list_filter = ["stage", "owner"]
    search_fields = ["title", "customer__name"]
    list_select_related = ["customer", "owner"]
    autocomplete_fields = ["customer"]
    readonly_fields = ["erp_order_number", "converted_at", "created_at", "updated_at"]
    inlines = [OpportunityStageChangeInline]
