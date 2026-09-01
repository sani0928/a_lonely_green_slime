from django.core.management.base import BaseCommand
from django.utils import timezone

from events.models import EventPrize


class Command(BaseCommand):
    help = "Delete prize email snapshots after their 90-day retention deadline."

    def handle(self, *args, **options):
        count = EventPrize.objects.filter(
            email_delete_after__lte=timezone.now(),
            email_snapshot__gt="",
        ).update(email_snapshot="")
        self.stdout.write(self.style.SUCCESS(f"Purged {count} prize email snapshots."))
