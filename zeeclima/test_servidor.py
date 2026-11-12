import unittest,json
from datetime import datetime,timezone,timedelta
from zeeclima.servidor import parse_inmet,parse_roni,parse_relative,municipalities,parse_forecast,municipal_forecast

class MonitorTests(unittest.TestCase):
    def warning(self,**updates):
        now=datetime.now(timezone.utc)-timedelta(hours=3)
        row={'inicio':(now-timedelta(hours=1)).strftime('%Y-%m-%d %H:%M'),'fim':(now+timedelta(hours=1)).strftime('%Y-%m-%d %H:%M'),'severidade':'Perigo','geocodes':'2927408,2111300','codigo':'teste-1','id_aviso':1,'descricao':'Tempestade','poligono':None}
        row.update(updates);return row
    def test_excludes_expired_and_future_notices(self):
        current=self.warning();expired=self.warning(codigo='expirado',inicio='2000-01-01 00:00',fim='2000-01-02 00:00');future=self.warning(codigo='futuro',inicio='2090-01-01 00:00',fim='2090-01-02 00:00')
        result=parse_inmet(json.dumps({'hoje':[current,expired],'futuro':[future]}))
        self.assertEqual(result['count'],1);self.assertEqual(result['alerts'][0]['ufs'],['BA','MA'])
    def test_preserves_municipality_codes_with_whitespace(self):
        row=self.warning(geocodes=' 2927408, 2111300,2111300 ')
        alert=parse_inmet(json.dumps({'hoje':[row]}))['alerts'][0]
        self.assertEqual(alert['municipality_codes'],['2111300','2927408'])
        self.assertEqual(alert['ufs'],['BA','MA'])
    def test_rejects_invalid_municipality_route_without_network(self):
        with self.assertRaises(ValueError):municipalities('../monitor')
    def test_deduplicates_current_notice_across_source_lists(self):
        current=self.warning();result=parse_inmet(json.dumps({'hoje':[current],'futuro':[current]}));self.assertEqual(result['count'],1)
    def test_unknown_severity_does_not_become_no_warning(self):
        with self.assertRaises(ValueError):parse_inmet(json.dumps({'hoje':[self.warning(severidade='novo formato desconhecido')]}))
    def test_invalid_validity_does_not_become_no_warning(self):
        with self.assertRaises(ValueError):parse_inmet(json.dumps({'hoje':[self.warning(fim='data inválida')]}))
    def test_roni_keeps_period_and_missing_future_cells(self):
        html='<table><tr><td>2026</td><td>-0.9</td><td>-0.8</td><td></td></tr></table>'
        result=parse_roni(html);self.assertEqual(result['latest'],{'year':2026,'season':'JFM','value':-.8})
    def test_monthly_relative_index_is_not_roni(self):
        result=parse_relative('YEAR MON rNINO1+2 rNINO3 rNINO4 rNINO3.4\n2026 10 4.43 3.56 0.11 2.47\n')
        self.assertEqual(result['latest'],{'year':2026,'month':10,'value':2.47});self.assertNotIn('season',result['latest'])
    def test_forecast_preserves_periods_and_missing_values(self):
        raw=json.dumps({'2111300':{'12/11/2026':{'manha':{'resumo':'Muitas nuvens','temp_min':27,'temp_max':33,'umidade_min':None,'icone':'ignorar'}},'13/11/2026':{'resumo':'Chuva','temp_min':26,'temp_max':32}}})
        data=parse_forecast(raw,'2111300')
        self.assertEqual(data['days'][0]['date'],'2026-11-12')
        self.assertEqual(data['days'][0]['periods'][0]['period'],'manha')
        self.assertIsNone(data['days'][0]['periods'][0]['umidade_min'])
        self.assertNotIn('icone',data['days'][0]['periods'][0])
        self.assertEqual(data['days'][1]['periods'][0]['period'],'dia')
    def test_missing_municipal_forecast_does_not_become_fair_weather(self):
        with self.assertRaises(ValueError):parse_forecast('{"outro":{}}','2111300')
        with self.assertRaises(ValueError):parse_forecast('{"2111300":{}}','2111300')
    def test_forecast_rejects_invalid_code_without_network(self):
        with self.assertRaises(ValueError):municipal_forecast('../monitor')
    def test_malformed_series_fails_explicitly(self):
        with self.assertRaises(ValueError):parse_relative('Fonte indisponível')

if __name__=='__main__':unittest.main()
