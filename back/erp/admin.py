from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["number", "customer_name", "total", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["number", "customer_name", "customer_document", "idempotency_key"]
    readonly_fields = ["number", "idempotency_key", "created_at", "updated_at"]
    inlines = [OrderItemInline]
