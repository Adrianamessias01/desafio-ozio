from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("erp", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE SEQUENCE IF NOT EXISTS erp_order_number_seq",
            reverse_sql="DROP SEQUENCE IF EXISTS erp_order_number_seq",
        ),
    ]
