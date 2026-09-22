import unittest,copy,collections
from unittest.mock import patch
from simulate import *

def job():
    j=cohort()[0].copy();j.update(id='TEST',index=777,arrival=0,deadline=6*DAY,adapter='native-public',estimate_minutes=20,stages=1,price=100*U,value=200*U,assumed_quality=1.)
    return j
class ModelTests(unittest.TestCase):
    def test_frozen_population(self):
        js=cohort();self.assertEqual(len(js),10000);self.assertEqual(len({j['id'] for j in js}),10000);self.assertEqual(sum(c[1] for c in CLASSES),10000)
    def test_integer_conservation_and_rounding(self):
        for p in [1,7,1000001,35000000,88888888000000]:
            ab=min(p,1234567);rb=min(p,10000000)
            for ap,rj in [(0,0),(1,0),(0,3),(2,1),(25,25),(50,0)]:
                for o in ['agentWin','buyerWin','neutralTimeout','buyerAcceptance']:
                    s=settlement(p,ab,rb,ap,rj,o)
                    self.assertEqual(sum(s[k] for k in ['buyer','agent','wallet30','wallet10'])+ap*s['approve_each']+rj*s['reject_each'],s['total'])
    def test_gross_payout_shares(self):
        s=settlement(100*U,5*U,15*U,3,0,'agentWin')
        self.assertEqual(s['wallet30'],30*U);self.assertEqual(s['wallet10'],10*U)
        self.assertEqual(s['agent'],57*U+2) # own bond + 52% plus two rounding micro-USDC
    def test_non_delivery_is_not_neutral(self):
        a=settlement(100*U,5*U,15*U,0,0,'noSubmission');b=settlement(100*U,5*U,15*U,0,0,'neutralTimeout')
        self.assertEqual(a['buyer'],105*U);self.assertEqual(b['buyer'],100*U);self.assertEqual(b['agent'],5*U)
    def test_current_evidence_never_opens_intake(self):
        s=Simulation([job()],dict(BASE,qualified=False));r=s.run();self.assertEqual(r['admitted'],0);self.assertEqual(r['compute_cost_USDC'],0);self.assertEqual(s.total_deposits,0)
    def test_two_mac_default_cannot_fake_three_controllers(self):
        s=Simulation([job()],SCENARIOS['two_macs_defaults']);r=s.run();self.assertEqual(r['admitted'],0);self.assertEqual(s.rows['TEST']['reason'],'insufficient_independent_reviewers')
    def test_unsupported_even_without_economic_screen(self):
        j=job();j['adapter']='broker-scoped';s=Simulation([j],dict(BASE,screen=False));s.run();self.assertEqual(s.rows['TEST']['reason'],'unsupported_authority_or_provider')
    def test_no_hidden_truth_in_admission(self):
        decisions=[]
        with patch('simulate.rand',return_value=.5):
            for truth in [False,True]:
                s=Simulation([job()],BASE);j=s.rows['TEST'];j['good']=truth;s.offer(j);decisions.append((j['status'],j['expected_agent_margin'],j['expected_node_margin']))
        self.assertEqual(*decisions)
    def test_assignment_expiry_keeps_bond_locked_until_deadline(self):
        with patch('simulate.rand',return_value=.5):
            s=Simulation([job()],BASE);j=s.rows['TEST'];s.offer(j);locked=s.locked;s.t=10;s.finish(j,'noSubmission');self.assertEqual(s.locked,locked)
            s.t=j['deadline'];s.finish(j,'noSubmission');self.assertEqual(s.locked,0);self.assertEqual(s.active[j['agent_id']],0)
            self.assertEqual(j['paid']['buyer'],j['price']+j['agent_bond'])
    def test_default_seven_day_review_clock(self):
        c=dict(BASE,review_days=7,challenge_hours=24,false_rejection=0,absence=0,human_hours=24)
        with patch('simulate.rand',return_value=.5):
            s=Simulation([job()],c);s.run();j=s.rows['TEST']
        self.assertEqual(j['outcome'],'agentWin');self.assertGreaterEqual(j['settled_at'],j['submitted_at']+7*DAY)
    def test_deferred_cash_is_not_received_or_lost(self):
        with patch('simulate.rand',return_value=.5):
            s=Simulation([job()],BASE);j=s.rows['TEST'];s.offer(j)
        s.t=j['deadline']
        with patch('simulate.rand',return_value=.001):s.finish(j,'neutralTimeout')
        self.assertEqual(s.total_paid,0);self.assertEqual(s.total_claims,s.total_deposits);self.assertEqual(s.locked,0)
    def test_human_shift_never_charges_waiting_as_labor(self):
        s=Simulation([job()],dict(BASE,human_hours=2));s.t=119
        self.assertEqual(s.human_end(3),1442)
    def test_fractional_shift_boundary_finishes(self):
        s=Simulation([job()],dict(BASE,human_hours=2));s.t=50*DAY+119
        self.assertAlmostEqual(s.human_end(1+5e-10),50*DAY+120,places=8)
    def test_compute_charge_never_exceeds_reserved_budget(self):
        with patch('simulate.rand',return_value=.5):
            s=Simulation([job()],BASE);j=s.rows['TEST'];s.offer(j)
            j['work_budget']=U
            with patch('simulate.lognormal',return_value=2):s.start_work(j,j['agent_id'])
        self.assertEqual(j['compute_cost'],U)
        self.assertTrue(any(e[2]=='work_done' and e[4][1]=='compute_reservation_exhausted' for e in s.heap))
    def test_moderator_queue_cannot_disable_neutral_recovery(self):
        with patch('simulate.rand',return_value=.5):
            s=Simulation([job()],BASE);j=s.rows['TEST'];s.offer(j);j['good']=False;s.dispute(j)
        times=[e[0] for e in s.heap if e[2]=='neutral'];self.assertEqual(times,[28*DAY+.001])
    def test_actor_active_limit_is_enforced(self):
        s=Simulation([job()],dict(BASE,active_cap=3));s.active=[3]*BASE['agents'];s.offer(s.rows['TEST']);self.assertEqual(s.rows['TEST']['reason'],'agent_active_job_cap')
if __name__=='__main__':unittest.main(verbosity=2)
