from datetime import date, time

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Professional, ScheduleException, WorkingHours


class ProfessionalsModelAndAPITests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_prof',
            password='password123',
            is_staff=True,
        )
        self.barber_user = User.objects.create_user(
            username='barber_prof',
            password='password123',
            is_staff=False,
        )
        self.professional = Professional.objects.create(
            user=self.barber_user,
            display_name='André Barber',
            slug='andre-barber',
            phone_number='11977770001',
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.admin)

    def test_holiday_auto_fills_reason_and_all_day(self):
        christmas = ScheduleException.objects.create(
            professional=None,
            date=date(2026, 12, 25),
            exception_type=ScheduleException.ExceptionType.HOLIDAY,
        )
        self.assertTrue(christmas.is_all_day)
        self.assertEqual(christmas.reason, 'Natal')

    def test_working_hours_validation_and_bulk_update_api(self):
        invalid_wh = WorkingHours(
            professional=self.professional,
            day_of_week=WorkingHours.DayOfWeek.MONDAY,
            is_working=True,
            start_time=time(18, 0),
            end_time=time(9, 0),
        )
        with self.assertRaises(ValidationError):
            invalid_wh.clean()

        url = reverse(
            'admin-professionals-working_hours',
            args=[self.professional.id],
        )
        payload = [
            {
                'day_of_week': 1,
                'is_working': True,
                'start_time': '09:00',
                'end_time': '18:00',
                'break_start': '12:00',
                'break_end': '13:00',
            },
            {
                'day_of_week': 7,
                'is_working': False,
            },
        ]
        resp = self.api.put(url, payload, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)
