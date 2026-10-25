from django.core.management.base import BaseCommand

from crm.constants import DEMO_PASSWORD
from crm.models import User
from crm.seed_data import seed_database


class Command(BaseCommand):
    help = "Load demo users, leads, cases, and payouts."

    def handle(self, *args, **options):
        if User.objects.filter(email="admin@adrya.test").exists():
            self.stdout.write("Already seeded. Sign in with admin@adrya.test")
            return
        seed_database()
        self.stdout.write(self.style.SUCCESS(f"Seeded ADYRA CRM. Password for every demo login: {DEMO_PASSWORD}"))
