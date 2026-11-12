import unittest
from unittest.mock import patch
from api.zeeclima import dispatch


class ZeeclimaRoutes(unittest.TestCase):
    def test_rejects_arbitrary_resources_and_invalid_codes(self):
        with self.assertRaises(ValueError):dispatch({'resource':['https://example.com']})
        with self.assertRaises(ValueError):dispatch({'resource':['municipios'],'uf':['../api']})
        with self.assertRaises(ValueError):dispatch({'resource':['tempo'],'code':['invalid']})

    def test_forecast_route_preserves_city_code(self):
        with patch('api.zeeclima.municipal_forecast',return_value={'status':'unavailable'}) as fetch:
            self.assertEqual(dispatch({'resource':['tempo'],'code':['2111300']}),{'status':'unavailable'})
            fetch.assert_called_once_with('2111300')
