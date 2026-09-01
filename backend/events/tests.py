from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from accounts.models import GoogleAccount
from .models import Event, EventPrize, EventRun
from .services import ranking_rows, refresh_prizes


class EventRankingTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.event = Event.objects.create(starts_at=now, ends_at=now + timedelta(days=6))
        self.first = self.make_user("first", "first@example.com")
        self.second = self.make_user("second", "second@example.com")

    def make_user(self, nickname, email):
        user = User.objects.create_user(username=nickname)
        GoogleAccount.objects.create(user=user, google_sub=f"sub-{nickname}", event_nickname=nickname, email=email, email_verified=True)
        return user

    def finish(self, user, score, seconds=1):
        started = timezone.now()
        return EventRun.objects.create(
            event=self.event, user=user, status=EventRun.Status.FINISHED,
            started_at=started, finished_at=started + timedelta(seconds=seconds), score=score, play_seconds=seconds, seed="seed",
        )

    def test_high_score_and_aggregate_rankings_are_account_based(self):
        self.finish(self.first, 100, 1)
        self.finish(self.first, 70, 2)
        self.finish(self.second, 120, 3)
        high = ranking_rows(self.event, "high_score")
        aggregate = ranking_rows(self.event, "aggregate")
        self.assertEqual(high[0]["user"], self.second)
        self.assertEqual(high[0]["score"], 120)
        self.assertEqual(aggregate[0]["user"], self.first)
        self.assertEqual(aggregate[0]["score"], 170)

    def test_prizes_use_distinct_winners_with_high_score_priority(self):
        self.finish(self.first, 200, 1)
        self.finish(self.first, 150, 2)
        self.finish(self.second, 180, 3)
        refresh_prizes(self.event)
        high = EventPrize.objects.get(event=self.event, category=EventPrize.Category.HIGH_SCORE)
        aggregate = EventPrize.objects.get(event=self.event, category=EventPrize.Category.AGGREGATE)
        self.assertEqual(high.user, self.first)
        self.assertEqual(aggregate.user, self.second)
