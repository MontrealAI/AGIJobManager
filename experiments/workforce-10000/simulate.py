#!/usr/bin/env python3
"""Deterministic, event-driven planning experiment; no models, wallets or network calls."""
from __future__ import annotations
import argparse, collections, copy, gzip, hashlib, heapq, json, math, statistics, time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
U=1_000_000; DAY=1440; N=10_000
def money(x): return int(round(x*U))
def usd(x): return round(x/U,6)
def rand(seed,j,label):
    b=hashlib.blake2b(f'{seed}|{j}|{label}'.encode(),digest_size=8).digest()
    return (int.from_bytes(b,'big')+.5)/2**64
def lognormal(seed,j,label,sigma):
    z=math.sqrt(-2*math.log(rand(seed,j,label+'a')))*math.cos(2*math.pi*rand(seed,j,label+'b'))
    return math.exp(sigma*z-sigma*sigma/2)
def percentile(xs,p):
    if not xs:return None
    xs=sorted(xs);k=(len(xs)-1)*p;i=int(k)
    return xs[i]+(xs[min(i+1,len(xs)-1)]-xs[i])*(k-i)
def dump(p,obj): p.write_text(json.dumps(obj,indent=2,sort_keys=True)+'\n')

CLASSES=[
 ('spreadsheets',1200,60,80,.88,'Reconcile totals and formulas against original records'),
 ('documents',900,70,95,.90,'Create a fact-checked document from supplied material'),
 ('research',1000,100,130,.79,'Produce an evidence-linked research brief'),
 ('code',1100,150,200,.84,'Implement a bounded change with independent tests'),
 ('websites',700,180,250,.85,'Build and independently navigate a requested workflow'),
 ('crm-workflows',900,45,80,.90,'Apply authorized CRM changes with receipts'),
 ('data-entry',1400,25,35,.95,'Transform and reconcile structured records'),
 ('visual-editing',600,100,140,.80,'Produce an editable asset meeting explicit constraints'),
 ('quality-assurance',900,90,130,.88,'Find and reproduce defects against acceptance criteria'),
 ('business-operations',600,70,110,.88,'Complete a bounded operations workflow'),
 ('multiple-applications',700,180,460,.83,'Produce, independently review, integrate and re-review')]

BASE=dict(agents=8,nodes=4,quorum=3,active_cap=40,review_days=1,challenge_hours=6,
          human_hours=2,screen=True,future_bridge=False,compute_multiplier=1.,gas_multiplier=1.,
          quality_shift=0.,common_error=.025,individual_false_approval=.07,false_rejection=.035,
          absence=.035,stress=False,qualified=True,agent_capital=2500,node_capital=3000,buyer_capital=75000,automatic_moderation=0.)
SCENARIOS={
 'current_evidence':dict(BASE,qualified=False,agents=1,nodes=1),
 'two_macs_defaults':dict(BASE,agents=1,nodes=1,active_cap=3,review_days=7,challenge_hours=24),
 'two_macs_one_vote':dict(BASE,agents=1,nodes=1,quorum=1,active_cap=20),
 'fleet_defaults':dict(BASE,agents=8,nodes=4,active_cap=3,review_days=7,challenge_hours=24),
 'qualified_8x4':dict(BASE),
 'unscreened_8x4':dict(BASE,screen=False),
 'human_capacity_8h':dict(BASE,human_hours=8),
 'future_automated_bridge':dict(BASE,future_bridge=True),
 'future_bridge_and_moderation':dict(BASE,future_bridge=True,automatic_moderation=.80),
 'correlated_validation':dict(BASE,human_hours=8,common_error=.20),
 'compound_stress':dict(BASE,stress=True,compute_multiplier=2.,gas_multiplier=5.,quality_shift=-.12),
 'capital_constrained':dict(BASE,agent_capital=150,node_capital=250,buyer_capital=5000),
}
LABELS={
 'current_evidence':'Current evidence: production closed', 'two_macs_defaults':'Two Macs / contract defaults',
 'two_macs_one_vote':'Two Macs / hypothetical one-vote policy', 'fleet_defaults':'8 Agents + 4 Nodes / defaults',
 'qualified_8x4':'8 + 4 / bounded intake / 2 human h/day', 'unscreened_8x4':'8 + 4 / no economic or queue screen',
 'human_capacity_8h':'8 + 4 / 8 human h/day', 'future_automated_bridge':'Future bridge / 2 human h/day',
 'future_bridge_and_moderation':'Future bridge + 80% automated moderation',
 'correlated_validation':'8 + 4 / correlated validation errors', 'compound_stress':'8 + 4 / compound stress',
 'capital_constrained':'8 + 4 / constrained working capital'}

def cohort():
    out=[];i=0
    for name,count,mins,price,quality,objective in CLASSES:
        for _ in range(count):
            i+=1;key=f'J{i:05d}';u=rand(1001,i,'adapter')
            adapter=('isolated-public' if u<.45 else 'native-public' if u<.75 else 'native-confidential' if u<.90 else 'broker-scoped' if u<.98 else 'local-only')
            if name=='multiple-applications':adapter='native-public' if u<.75 else 'native-confidential' if u<.90 else 'broker-scoped'
            difficulty=.65+1.1*rand(1001,i,'difficulty')
            est=(4+4*rand(1001,i,'small-work')) if adapter=='isolated-public' else mins*difficulty
            p=money(price*(.40 if adapter=='isolated-public' else 1)*(.65+.7*rand(1001,i,'price')))
            arrival=rand(1001,i,'arrival')*90*DAY
            # Arrival clustering on each day; no outcome is exposed to the screen.
            arrival=int(arrival//DAY)*DAY+((arrival%DAY)/DAY)**1.8*DAY
            deadline=arrival+DAY*(1+5*rand(1001,i,'deadline'))
            stages=2 if name=='multiple-applications' else 1
            out.append(dict(id=key,index=i,job_class=name,objective=objective,adapter=adapter,
                            arrival=round(arrival,6),deadline=round(deadline,6),estimate_minutes=round(est,6),
                            stages=stages,price=p,value=round(p*(1.4+rand(1001,i,'value'))),
                            assumed_quality=round(max(.55,min(.98,quality-.10*(difficulty-1))),6)))
    assert len(out)==N
    return sorted(out,key=lambda j:(j['arrival'],j['id']))

def settlement(price,ab,rb,ap,rj,outcome,dispute=0,initiator='none'):
    """Separate integer implementation; compared to release assess.cjs for every terminal row."""
    total=price+ab+(ap+rj)*rb+dispute
    if outcome=='noSubmission':return dict(buyer=price+ab,agent=0,approve_each=0,reject_each=0,wallet30=0,wallet10=0,total=total)
    if outcome=='cancelled':return dict(buyer=price,agent=0,approve_each=0,reject_each=0,wallet30=0,wallet10=0,total=total)
    neutral=outcome=='neutralTimeout';win=outcome in ('agentWin','buyerAcceptance')
    correct=0 if neutral else ap if win else rj
    slash=0 if neutral or outcome=='buyerAcceptance' else rb*8000//10000
    reward=0 if neutral else price*8//100 if ((win and ap+rj) or (not win and correct)) else 0
    if not win:reward=min(reward,ab)
    pool=reward+slash*(ap+rj-correct);each=pool//correct if correct else 0;remainder=pool-each*correct
    w30=price*30//100 if win else 0;w10=price*10//100 if win else 0
    agent=(price-reward-w30-w10+remainder if win else 0)+(ab if win or neutral else 0)+(dispute if win or neutral and initiator=='agent' else 0)
    buyer=price+(dispute if initiator=='buyer' else 0) if neutral else 0 if win else price+ab-reward+remainder+dispute
    ae=rb+(each if win and not neutral else -slash);re=rb+(each if not win and not neutral else -slash)
    assert buyer+agent+w30+w10+ap*ae+rj*re==total
    return dict(buyer=buyer,agent=agent,approve_each=ae,reject_each=re,wallet30=w30,wallet10=w10,total=total)

class Simulation:
    def __init__(self,jobs,config,seed=20260922,record=False):
        self.c=config;self.seed=seed;self.record=record;self.t=0;self.serial=0;self.heap=[];self.events=[]
        self.rows={j['id']:dict(j,status='offered',reason=None,stage=0,work_minutes=0.,review_minutes=0.,human_minutes=0.,compute_cost=0,gas_cost=0,human_cost=0,capital_cost=0,external_loss=0,
            deposits=collections.defaultdict(int),entitlements=collections.defaultdict(int),paid=collections.defaultdict(int),claims=collections.defaultdict(int),votes={},stage_votes={},review_ids=[],
            interruptions=0,unsafe_stops=0,attempts=0,good=None,submitted_at=None,settled_at=None,completed_at=None,outcome=None,settlement=None,active=False) for j in jobs}
        self.agent_busy=[False]*config['agents'];self.node_busy=[False]*config['nodes'];self.active=[0]*config['agents']
        self.aq=[collections.deque() for _ in self.agent_busy];self.nq=[collections.deque() for _ in self.node_busy];self.hq=collections.deque();self.hbusy=False
        # Offered jobs have separate demand budgets. Rolling escrow capacity must not
        # be confused with a single buyer's lifetime spending budget.
        self.bal={'buyer':sum(j['price'] for j in jobs)+money(N*200),**{f'agent{i}':money(config['agent_capital']) for i in range(config['agents'])},**{f'node{i}':money(config['node_capital']) for i in range(config['nodes'])}}
        self.buyer_locked=0;self.buyer_pending=0
        self.node_reserved=[0]*config['nodes'];self.max_locked=0;self.locked=0;self.max_active=0;self.total_deposits=0;self.total_paid=0;self.total_claims=0
        self.costs=collections.defaultdict(int);self.daily=collections.defaultdict(lambda:collections.Counter());self.agent_daily=collections.defaultdict(int);self.node_daily=collections.defaultdict(int)
        self.previous_hash='0'*64;self.hash_count=0;self.allowed_time=150*DAY
        for j in jobs:self.push(j['arrival'],'offer',j['id'])
    def push(self,t,kind,jid=None,extra=None):
        assert t+1e-5>=self.t,(t,self.t,kind)
        self.serial+=1;heapq.heappush(self.heap,(t,self.serial,kind,jid,extra))
    def event(self,j,kind,**details):
        if not self.record:return
        row=dict(time_minutes=round(self.t,6),job_id=j['id'] if j else None,event=kind,details=details,previous=self.previous_hash)
        h=hashlib.sha256(json.dumps(row,sort_keys=True,separators=(',',':')).encode()).hexdigest();row['hash']=h;self.previous_hash=h;self.hash_count+=1;self.events.append(row)
    def cost(self,j,role,kind,amount):
        amount=max(0,int(amount));j[kind+'_cost']+=amount;self.costs[role]+=amount
    def gas(self,j,role,tx=1):self.cost(j,role,'gas',money(.40*self.c['gas_multiplier']*tx))
    def deposit(self,j,role,amount):
        assert self.bal[role]>=amount,(role,self.bal[role],amount)
        self.bal[role]-=amount;j['deposits'][role]+=amount;self.locked+=amount;self.total_deposits+=amount;self.max_locked=max(self.max_locked,self.locked)
        self.event(j,'deposit',role=role,microUSDC=amount)
    def reject(self,j,reason):j.update(status='rejected',reason=reason);self.event(j,'rejected',reason=reason)
    def predicted_human_wait(self):
        return (sum(x[1] for x in self.hq)+(10 if self.hbusy else 0))/max(1,self.c['human_hours']*60)*DAY
    def offer(self,j):
        c=self.c
        if not c['qualified']:return self.reject(j,'missing_operational_evidence')
        if j['adapter'] in ('broker-scoped','local-only'):return self.reject(j,'unsupported_authority_or_provider')
        if c['nodes']<c['quorum']:return self.reject(j,'insufficient_independent_reviewers')
        a=min(range(c['agents']),key=lambda i:(self.active[i],len(self.aq[i]),i))
        if self.active[a]>=c['active_cap']:return self.reject(j,'agent_active_job_cap')
        rs=sorted(range(c['nodes']),key=lambda i:(len(self.nq[i]),self.node_reserved[i],i))[:c['quorum']]
        native=j['adapter']!='isolated-public';hm=(.5 if c['future_bridge'] else 6 if j['adapter']=='native-public' else 8) if native else .12
        if j['stages']==2:hm+=.5 if c['future_bridge'] else 4
        declared=(10 if not native else j['estimate_minutes']*2)*j['stages']
        ab=max(U,j['price']*500//10000);ab=min(j['price'],ab+ab*int((j['deadline']-j['arrival'])*60)//10_000_000)
        rb=min(j['price'],max(10*U,j['price']*1500//10000))
        # Prediction uses declared class assumptions, not latent quality or future verdicts.
        p=j['assumed_quality'];work_cost=j['estimate_minutes']*j['stages']*.04*c['compute_multiplier']
        review_cost=max(2,j['estimate_minutes']*.25)*j['stages']*.05*c['compute_multiplier']
        expected_agent=p*.52*usd(j['price'])-(1-p)*usd(ab)-work_cost-1.2*c['gas_multiplier']
        expected_node=(p*.08+(1-p)*.05)*usd(j['price'])/c['quorum']-review_cost-.4*c['gas_multiplier']-.035*usd(rb)*.8
        j['expected_agent_margin']=round(expected_agent,6);j['expected_node_margin']=round(expected_node,6)
        queue=sum(self.rows[k]['estimate_minutes']*self.rows[k]['stages'] for k in self.aq[a])+(j['estimate_minutes'] if self.agent_busy[a] else 0)
        if c['screen'] and (expected_agent<.5 or expected_node<.1 or usd(j['value']-j['price'])<hm*1.25):return self.reject(j,'modeled_economics')
        if c['screen'] and self.t+declared+queue+self.predicted_human_wait()+DAY*.6>=j['deadline']:return self.reject(j,'forecast_deadline_or_human_queue')
        if self.buyer_locked+self.buyer_pending+j['price']>money(c['buyer_capital']) or self.bal[f'agent{a}']<ab or any(self.bal[f'node{i}']-self.node_reserved[i]<rb for i in rs):return self.reject(j,'working_capital')
        day=int(self.t//DAY);ar=money(declared*.04*c['compute_multiplier']);nr=money(max(2,j['estimate_minutes']*.5)*j['stages']*.05*c['compute_multiplier'])
        if self.agent_daily[(a,day)]+ar>money(200) or any(self.node_daily[(i,day)]+nr>money(120) for i in rs):return self.reject(j,'durable_daily_compute_budget')
        # A funded but unassigned offer can be canceled without an Agent bond.
        if rand(self.seed,j['index'],'buyer-cancel')<.012:
            j.update(status='funded_unassigned',admitted_at=self.t,agent_id=a,review_ids=[],agent_bond=0,reviewer_bond=rb)
            self.buyer_locked+=j['price'];self.deposit(j,'buyer',j['price']);self.gas(j,'buyer');self.push(self.t+20,'cancel',j['id']);return
        self.agent_daily[(a,day)]+=ar
        for i in rs:self.node_daily[(i,day)]+=nr;self.node_reserved[i]+=rb
        j.update(status='admitted',admitted_at=self.t,agent_id=a,review_ids=rs,agent_bond=ab,reviewer_bond=rb,manual_minutes=hm,work_budget=ar,review_budget_each=nr,active=True)
        self.active[a]+=1;self.buyer_locked+=j['price'];self.max_active=max(self.max_active,sum(self.active));self.deposit(j,'buyer',j['price']);self.deposit(j,f'agent{a}',ab)
        self.gas(j,'buyer');self.gas(j,f'agent{a}');self.hq.append((j['id'],hm,'grant'));self.push(j['deadline'],'expire',j['id']);self.event(j,'admitted',agent=a,reviewers=rs,reserved_work_microUSDC=ar,reserved_review_each_microUSDC=nr)
    def available_human(self):
        cap=self.c['human_hours']*60;within=self.t%DAY
        return self.t if within<cap else (int(self.t//DAY)+1)*DAY
    def human_end(self,duration):
        t=self.available_human();left=duration;cap=self.c['human_hours']*60
        # Use the same tolerance for continuation and advancing to the next shift.
        # Otherwise a sub-nanominute residue at a shift boundary loops forever.
        while left>1e-9:
            chunk=min(left,max(0,cap-t%DAY));t+=chunk;left-=chunk
            if left>1e-9:t=(int(t//DAY)+1)*DAY
        return t
    def dispatch(self):
        # Queues only dispatch to free resources. Canceled work does not occupy future slots.
        if not self.hbusy:
            while self.hq:
                jid,mins,purpose=self.hq[0];j=self.rows[jid]
                if j['outcome'] or j['status']=='rejected':self.hq.popleft();continue
                start=self.available_human()
                if start>self.t+1e-6:self.hbusy=True;self.push(start,'human_wake');break
                self.hq.popleft();self.hbusy=True;end=self.human_end(mins)
                self.push(end,'human_done',jid,(mins,purpose));break
        for a in range(len(self.agent_busy)):
            if self.agent_busy[a]:continue
            while self.aq[a]:
                jid=self.aq[a].popleft();j=self.rows[jid]
                if j['outcome'] or j['submitted_at'] is not None:continue
                self.start_work(j,a);break
        for n in range(len(self.node_busy)):
            if self.node_busy[n]:continue
            while self.nq[n]:
                jid,stage=self.nq[n].popleft();j=self.rows[jid]
                if j['outcome'] or stage!=j['stage']:continue
                if self.t>j['stage_review_end']:self.record_vote(j,n,'absent');continue
                self.start_review(j,n);break
    def blocked_end(self,start,duration):
        end=start+duration
        outages=[(30*DAY,30*DAY+180)]
        if self.c['stress']:outages += [(45*DAY,46*DAY),(65*DAY,65*DAY+720)]
        count=0
        for lo,hi in outages:
            if start<hi and end>lo:end+=hi-max(start,lo);count+=1
        return end,count
    def start_work(self,j,a):
        maximum=10 if j['adapter']=='isolated-public' else 2*j['estimate_minutes']
        if self.t+maximum+1>j['deadline']:
            j['reason']='insufficient_execution_window';self.finish(j,'noSubmission');return
        j['status']='working';j.setdefault('started_at',self.t);j['attempts']+=1;self.agent_busy[a]=True
        k=j['index'];stage=j['stage'];duration=j['estimate_minutes']*lognormal(self.seed,k,f'duration{stage}',.45)
        if rand(self.seed,k,f'runtime-drift-{stage}')<.015:
            self.push(self.t,'work_done',j['id'],(a,'runtime_identity_changed'));self.event(j,'runtime_rejected_before_inference');return
        limit=10 if j['adapter']=='isolated-public' else 2*j['estimate_minutes'];reason=None
        if duration>limit:duration=limit;reason='watchdog'
        restart=rand(self.seed,k,f'restart{stage}')<(.06 if not self.c['stress'] else .18)
        if restart:duration+=min(3,limit*.1);j['interruptions']+=1;self.event(j,'checkpoint_resume',accounting_reset=False,stage=stage)
        uncertain=rand(self.seed,k,f'uncertain{stage}')<(.008 if not self.c['stress'] else .035)
        if uncertain:duration*=.5;reason='uncertain_external_action';j['unsafe_stops']+=1
        if rand(self.seed,k,f'revoked-{stage}')<.006:duration*=.5;reason='authority_revoked';self.event(j,'authority_revoked',later_input_permitted=False)
        end,outages=self.blocked_end(self.t,duration);j['interruptions']+=outages
        if end>j['deadline']:duration=min(duration,max(0,j['deadline']-self.t));end=j['deadline'];reason='execution_deadline'
        rate=.04*self.c['compute_multiplier']
        remaining=max(0,j['work_budget']-money(j['work_minutes']*rate))
        charge=money(duration*rate)
        if charge>remaining:
            duration=remaining/(rate*U);charge=remaining
            end,_=self.blocked_end(self.t,duration);end=min(end,j['deadline'])
            reason='compute_reservation_exhausted'
        self.cost(j,f'agent{a}','compute',charge);j['work_minutes']+=duration
        j['stage_good']=rand(self.seed,k,f'quality{stage}')<max(.05,j['assumed_quality']+self.c['quality_shift'])
        self.push(end,'work_done',j['id'],(a,reason));self.event(j,'work_started',stage=stage,declared_max_minutes=limit)
    def work_done(self,j,a,reason):
        self.agent_busy[a]=False
        if j['outcome']:return
        if reason:
            j['reason']=reason
            if reason=='uncertain_external_action':self.hq.append((j['id'],12,'reconcile'))
            return self.finish(j,'noSubmission')
        if j['stage']==j['stages']-1:
            j['submitted_at']=self.t;j['good']=bool(j.get('prior_good',True) and j['stage_good']);self.gas(j,f"agent{j['agent_id']}")
        j['status']='reviewing';j['stage_review_end']=self.t+self.c['review_days']*DAY;j['stage_votes']={}
        for n in j['review_ids']:self.nq[n].append((j['id'],j['stage']))
        self.push(j['stage_review_end']+.0001,'review_expire',j['id'],j['stage'])
        self.event(j,'delivery_submitted' if j['submitted_at'] is not None else 'intermediate_delivery',stage=j['stage'])
    def start_review(self,j,n):
        if self.t+max(2,j['estimate_minutes']*.5)+1>min(j['stage_review_end'],j['deadline']):
            self.event(j,'review_window_rejected_before_inference',reviewer=n);self.record_vote(j,n,'absent');return
        self.node_busy[n]=True;k=j['index'];s=j['stage']
        duration=max(2,j['estimate_minutes']*.25)*lognormal(self.seed,k,f'review-duration-{s}-{n}',.3)
        duration=min(duration,max(2,j['estimate_minutes']*.5))
        end,outages=self.blocked_end(self.t,duration)
        if end>min(j['stage_review_end'],j['deadline']):end=min(j['stage_review_end'],j['deadline']);vote='absent'
        else:
            good=j['stage_good'] if j['submitted_at'] is None else j['good']
            # A shared job-level error causes correlated false approvals across all Nodes.
            shared=rand(self.seed,k,f'common-{s}')<self.c['common_error']
            if rand(self.seed,k,f'absence-{s}-{n}')<self.c['absence']:vote='absent'
            elif good:vote='reject' if rand(self.seed,k,f'vote-{s}-{n}')<self.c['false_rejection'] else 'approve'
            else:vote='approve' if shared or rand(self.seed,k,f'vote-{s}-{n}')<self.c['individual_false_approval'] else 'reject'
        charge=money(duration*.05*self.c['compute_multiplier']);self.cost(j,f'node{n}','compute',charge);j['review_minutes']+=duration
        self.push(end,'review_done',j['id'],(n,vote,s));self.event(j,'review_started',reviewer=n,stage=s)
    def record_vote(self,j,n,vote):
        if n in j['stage_votes']:return
        if j['submitted_at'] is not None and vote!='absent':
            self.node_reserved[n]-=j['reviewer_bond'];self.deposit(j,f'node{n}',j['reviewer_bond']);self.gas(j,f'node{n}')
        j['stage_votes'][n]=vote;self.event(j,'review_observed',reviewer=n,verdict=vote,stage=j['stage'])
        if len(j['stage_votes'])==len(j['review_ids']):self.review_complete(j)
    def review_complete(self,j):
        ap=sum(v=='approve' for v in j['stage_votes'].values());rj=sum(v=='reject' for v in j['stage_votes'].values())
        if j['submitted_at'] is None:
            if ap+rj<self.c['quorum'] or ap<=rj:j['reason']='intermediate_review_failed';return self.finish(j,'noSubmission')
            j['prior_good']=j.get('prior_good',True) and j['stage_good'];j['stage']+=1;j['stage_votes']={};j['status']='queued';self.aq[j['agent_id']].append(j['id']);return
        j['votes']=dict(j['stage_votes']);j['review_completed_at']=self.t
        # Disapproval threshold opens a dispute. A sub-threshold majority is resolved at the review deadline.
        disputed=rj>=self.c['quorum']
        buyer_challenge=(not j['good'] and ap>rj and rand(self.seed,j['index'],'buyer-detect')<.55)
        if disputed or buyer_challenge:return self.dispute(j,buyer_challenge)
        settle=max(j['stage_review_end'],self.t+self.c['challenge_hours']*60 if ap>=self.c['quorum'] else 0)+.001
        self.push(settle,'finalize',j['id'])
    def dispute(self,j,buyer=False):
        if j.get('disputed'):return
        j['disputed']=True;j['status']='disputed';j['disputed_at']=self.t
        if buyer:
            db=min(200*U,max(U,j['price']*50//10000))
            if self.bal['buyer']>=db:self.deposit(j,'buyer',db);j['dispute_bond']=db;j['dispute_initiator']='buyer';self.gas(j,'buyer')
        # A moderator can act immediately; owner fallback starts after 14 days; neutral after 28.
        if rand(self.seed,j['index'],'moderator-available')<(.90 if not self.c['stress'] else .65):
            self.push(self.t+60,'moderation',j['id'])
        elif rand(self.seed,j['index'],'owner-available')<.7:self.push(self.t+14*DAY+.001,'moderation',j['id'])
        self.push(self.t+28*DAY+.001,'neutral',j['id'])
        self.event(j,'dispute_opened',buyer_challenge=buyer)
    def finish(self,j,outcome):
        if j['outcome']:return
        # Unsubmitted failed work exits at its assignment deadline, not immediately.
        if outcome=='noSubmission' and self.t<j['deadline']-1e-5:
            j['status']='awaiting_expiry';return
        j['outcome']=outcome;j['settled_at']=self.t;j['status']='settled'
        if j['active']:self.active[j['agent_id']]-=1
        j['active']=False
        ap=sum(v=='approve' for v in j['votes'].values());rj=sum(v=='reject' for v in j['votes'].values());p=settlement(j['price'],j['agent_bond'],j['reviewer_bond'],ap,rj,outcome,j.get('dispute_bond',0),j.get('dispute_initiator','none'));j['settlement']=p
        recipients={'buyer':p['buyer'],f"agent{j['agent_id']}":p['agent'],'wallet30':p['wallet30'],'wallet10':p['wallet10']}
        for n in j['review_ids']:
            vote=j['votes'].get(n,'absent')
            if vote=='absent':self.node_reserved[n]-=j['reviewer_bond']
            else:recipients[f'node{n}']=p['approve_each' if vote=='approve' else 'reject_each']
        assert sum(j['deposits'].values())==p['total'],(j['id'],sum(j['deposits'].values()),p)
        self.gas(j,'buyer' if outcome=='cancelled' else 'operator');self.locked-=p['total'];self.buyer_locked-=j['price']
        j['capital_cost']=money(usd(sum(j['deposits'].values()))*.12*(self.t-j['admitted_at'])/DAY/365);self.costs['capital']+=j['capital_cost']
        self.event(j,'settled',outcome=outcome,total_microUSDC=p['total'])
        for role,amount in recipients.items():
            j['entitlements'][role]+=amount
            if not amount:continue
            deferred=rand(self.seed,j['index'],'deferred-'+role)<(.025 if not self.c['stress'] else .12)
            frozen=self.c['stress'] and 45*DAY<=self.t<59*DAY
            if deferred or frozen:
                j['claims'][role]+=amount;self.total_claims+=amount
                if role=='buyer':self.buyer_pending+=amount
                persistent=rand(self.seed,j['index'],'persistent-'+role)<.08
                if not persistent:self.push(max(self.t+3*DAY,59*DAY if frozen else self.t),'claim',j['id'],role)
                self.event(j,'claim_deferred',role=role,microUSDC=amount)
            else:self.pay(j,role,amount)
        if outcome in ('agentWin','buyerAcceptance') and j['good']:
            j['realized_value']=j['value'];self.daily[int(self.t//DAY)]['useful_settled']+=1
        elif outcome in ('agentWin','buyerAcceptance'):
            j['realized_value']=0;j['external_loss']=j['price']//4
        else:j['realized_value']=0
    def pay(self,j,role,amount):
        j['paid'][role]+=amount;self.total_paid+=amount
        if role in self.bal:self.bal[role]+=amount
        self.event(j,'cash_paid',role=role,microUSDC=amount)
    def run(self):
        while self.heap:
            t,_,kind,jid,e=heapq.heappop(self.heap)
            if t>self.allowed_time:break
            self.t=t;j=self.rows.get(jid)
            if kind=='offer':self.offer(j)
            elif kind=='cancel':self.finish(j,'cancelled')
            elif kind=='human_wake':self.hbusy=False
            elif kind=='human_done':
                self.hbusy=False;mins,purpose=e
                # Active human work is charged even if a concurrent timeout closed the job.
                j['human_minutes']+=mins;self.cost(j,'operator','human',money(mins*1.25))
                if not j['outcome']:
                    if purpose=='grant':j['status']='queued';self.aq[j['agent_id']].append(jid)
                    elif purpose=='moderate':
                        correct=rand(self.seed,j['index'],'moderation-correct')<.97
                        win=bool(j['good']) if correct else not bool(j['good']);self.finish(j,'agentWin' if win else 'buyerWin')
                self.event(j,'human_handling',minutes=mins,purpose=purpose)
            elif kind=='work_done':self.work_done(j,*e)
            elif kind=='review_done':
                n,vote,stage=e;self.node_busy[n]=False
                if not j['outcome'] and stage==j['stage']:self.record_vote(j,n,vote)
            elif kind=='review_expire':
                if not j['outcome'] and e==j['stage']:
                    for n in j['review_ids']:
                        if n not in j['stage_votes']:self.record_vote(j,n,'absent')
            elif kind=='finalize' and not j['outcome'] and not j.get('disputed'):
                if not j.get('canonical_wait') and rand(self.seed,j['index'],'rpc-delay')<.02:
                    j['canonical_wait']=True;self.event(j,'canonical_receipt_wait',minutes=360);self.push(self.t+360,'finalize',jid);self.dispatch();continue
                ap=sum(v=='approve' for v in j['votes'].values());rj=sum(v=='reject' for v in j['votes'].values())
                if ap+rj<self.c['quorum'] or ap==rj:self.dispute(j)
                else:self.finish(j,'agentWin' if ap>rj else 'buyerWin')
            elif kind=='moderation' and not j['outcome']:
                if rand(self.seed,j['index'],'automated-moderation')<self.c['automatic_moderation']:
                    correct=rand(self.seed,j['index'],'moderation-correct')<.97
                    win=bool(j['good']) if correct else not bool(j['good']);self.event(j,'hypothetical_automated_moderation');self.finish(j,'agentWin' if win else 'buyerWin')
                else:self.hq.append((jid,12,'moderate'))
            elif kind=='neutral' and not j['outcome']:self.finish(j,'neutralTimeout')
            elif kind=='expire' and j['status']!='rejected' and j['submitted_at'] is None and not j['outcome']:
                j['reason']=j['reason'] or 'queued_or_execution_deadline';self.finish(j,'noSubmission')
            elif kind=='claim':
                amount=j['claims'][e]
                if amount:
                    j['claims'][e]=0;self.total_claims-=amount
                    if e=='buyer':self.buyer_pending-=amount
                    self.pay(j,e,amount);self.gas(j,e if e in self.bal else 'operator')
            self.dispatch()
            assert self.locked>=0 and self.total_claims>=0 and all(x>=0 for x in self.node_reserved)
            assert all(0<=x<=self.c['active_cap'] for x in self.active)
            assert self.total_deposits==self.total_paid+self.total_claims+self.locked
        return self.summarize()
    def summarize(self):
        rows=list(self.rows.values());ad=[j for j in rows if 'admitted_at' in j];terminal=[j for j in ad if j['outcome']];wins=[j for j in terminal if j['outcome'] in ('agentWin','buyerAcceptance')];useful=[j for j in wins if j['good']];bad=[j for j in ad if j['submitted_at'] is not None and not j['good']]
        wrong=[j for j in wins if not j['good']];reviewed=[j for j in ad if j['submitted_at'] is not None];false_rejected=[j for j in reviewed if j['good'] and j['outcome']=='buyerWin']
        fixed=0 if not self.c['qualified'] else money((self.c['agents']+self.c['nodes'])*3*150+10*150)
        resource=sum(self.costs.values())+fixed;value=sum(j.get('realized_value',0) for j in rows);harm=sum(j['external_loss'] for j in rows)
        paid=collections.Counter();entitled=collections.Counter();deposits=collections.Counter()
        for j in rows:paid.update(j['paid']);entitled.update(j['entitlements']);deposits.update(j['deposits'])
        net=lambda prefix,claim:sum(v for k,v in (entitled if claim else paid).items() if k.startswith(prefix))-sum(v for k,v in deposits.items() if k.startswith(prefix))-sum(v for k,v in self.costs.items() if k.startswith(prefix))
        agent_fixed=0 if not self.c['qualified'] else money(self.c['agents']*3*150);node_fixed=0 if not self.c['qualified'] else money(self.c['nodes']*3*150)
        human=sum(j['human_minutes'] for j in rows);useful90=[j for j in useful if j['settled_at']<=90*DAY]
        report=dict(offered=N,admitted=len(ad),rejected=N-len(ad),terminal=len(terminal),unresolved=len(ad)-len(terminal),useful_settled=len(useful),useful_settled_by_day90=len(useful90),paid_bad=len(wrong),invalid_deliveries=len(bad),final_deliveries=len(reviewed),false_rejected_good=len(false_rejected),
            useful_rate_all_offers=len(useful)/N,useful_rate_admitted=len(useful)/len(ad) if ad else 0,false_acceptance_invalid=len(wrong)/len(bad) if bad else None,
            reject_reasons=dict(collections.Counter(j['reason'] for j in rows if j['status']=='rejected')),outcomes=dict(collections.Counter(j['outcome'] for j in terminal)),failure_reasons=dict(collections.Counter(j['reason'] for j in ad if j['reason'])),
            human_hours=human/60,human_minutes_per_useful=human/len(useful) if useful else None,agent_work_hours=sum(j['work_minutes'] for j in rows)/60,review_hours=sum(j['review_minutes'] for j in rows)/60,
            interruptions=sum(j['interruptions'] for j in rows),uncertain_actions_stopped=sum(j['unsafe_stops'] for j in rows),disputes=sum(bool(j.get('disputed')) for j in rows),
            paid_job_volume_USDC=usd(sum(j['price'] for j in wins)),useful_job_volume_USDC=usd(sum(j['price'] for j in useful)),
            resource_cost_USDC=usd(resource),compute_cost_USDC=usd(sum(j['compute_cost'] for j in rows)),gas_cost_USDC=usd(sum(j['gas_cost'] for j in rows)),human_cost_USDC=usd(sum(j['human_cost'] for j in rows)),fixed_cost_USDC=usd(fixed),capital_cost_USDC=usd(self.costs['capital']),
            assumed_realized_value_USDC=usd(value),external_harm_USDC=usd(harm),modeled_system_surplus_USDC=usd(value-resource-harm),
            employer_net_value_USDC=usd(value-harm+net('buyer',True)),agent_cash_net_USDC=usd(net('agent',False)-agent_fixed),agent_entitlement_net_USDC=usd(net('agent',True)-agent_fixed),
            node_cash_net_USDC=usd(net('node',False)-node_fixed),node_entitlement_net_USDC=usd(net('node',True)-node_fixed),
            wallet30_gross_USDC=usd(entitled['wallet30']),wallet10_gross_USDC=usd(entitled['wallet10']),central_operator_cost_USDC=usd(self.costs['operator']+(money(1500) if self.c['qualified'] else 0)),
            locked_peak_USDC=usd(self.max_locked),active_jobs_peak=self.max_active,unsettled_escrow_USDC=usd(self.locked),pending_claims_USDC=usd(self.total_claims),
            deposited_USDC=usd(self.total_deposits),paid_USDC=usd(self.total_paid),conservation_microUSDC=self.total_deposits-self.total_paid-self.total_claims-self.locked,
            settlement_days_p50=percentile([(j['settled_at']-j['arrival'])/DAY for j in terminal],.5),settlement_days_p95=percentile([(j['settled_at']-j['arrival'])/DAY for j in terminal],.95),
            simulation_event_count=self.serial,ledger_entries=self.hash_count,ledger_final_hash=self.previous_hash,
            by_class={cl[0]:dict(offered=sum(j['job_class']==cl[0] for j in rows),admitted=sum(j['job_class']==cl[0] for j in ad),useful=sum(j['job_class']==cl[0] for j in useful),paid_bad=sum(j['job_class']==cl[0] for j in wrong)) for cl in CLASSES},
            daily=[dict(day=d,**v) for d,v in sorted(self.daily.items())])
        return report

def serialize(rows):
    for j in rows:
        j=copy.deepcopy(j)
        for k in ['stage_votes','votes']:j[k]={str(x):y for x,y in j[k].items()}
        yield json.dumps(j,sort_keys=True,separators=(',',':'))+'\n'
def write_gzip(p,lines):
    with p.open('wb') as f:
        with gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as z:
            for line in lines:z.write(line.encode())

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--replicates',type=int,default=20);ap.add_argument('--out',type=Path,default=ROOT);args=ap.parse_args();out=args.out
    for n in ['results','data','evidence']:(out/n).mkdir(parents=True,exist_ok=True)
    jobs=cohort();dump(out/'data/COHORT.json',jobs)
    protocol=dict(schema='agi-jobs-simulation/v1',measurementKind='synthetic',created='2026-09-22',offer_count=N,intake_days=90,recovery_end_day=150,canonical_seed=20260922,replicates=args.replicates,
        classes=[dict(name=x[0],count=x[1],native_estimate_minutes=x[2],base_price_USDC=x[3],assumed_valid_probability=x[4],objective=x[5]) for x in CLASSES],scenarios=SCENARIOS,labels=LABELS,
        units='Exact integer micro-USDC for money; float minutes for event time',retainers=False,
        common_assumptions=dict(agent_compute_USDC_per_minute=.04,node_compute_USDC_per_minute=.05,gas_USDC_equivalent_per_action=.40,human_USDC_per_hour=75,capital_annual_rate=.12,machine_USDC_per_day=3,central_USDC_per_day=10,work_duration_lognormal_sigma=.45,review_duration_lognormal_sigma=.3,
             moderator_correct_probability=.97,moderator_available=.90,owner_fallback_available=.70,initial_reviewers='quorum distinct modeled controllers',buyer_detects_bad_majority=.55,payment_deferred_probability=.025,persistent_given_deferred=.08),
        limits=['All competence, prices, demand, work value, timing and costs are uncalibrated hypotheses, not live quotes or measured M1/M2 performance.','No LLM inference, native app work or public-chain transaction is run.','Production evidence is absent; operating scenarios assume future qualification without creating attestations.','Native/confidential paid settlement assumes explicit manual handoffs. Both future-bridge scenarios assume an unimplemented automatic bridge.','Broker-scoped and local-only offers remain unsupported in every scenario.','One job may have two internal work/review stages; they are not separately funded child contracts.','No new-authority repair/reassignment, privacy breach valuation, censorship/custody compromise or demand generation is modeled.','Human hours aggregate modeled handling and do not measure founder time.','Independent reviewer identities/controllers are assumed, not established by machine count.','Default contract active-job limits and settlement clocks apply unless a scenario explicitly changes them. No deployed configuration is changed.','No early buyer acceptance is used; quorum policy is retained for every modeled paid settlement.','Monte Carlo intervals measure stochastic model variation only, not uncertainty about real-world performance.'])
    dump(out/'PROTOCOL.json',protocol);dump(out/'evidence/FROZEN_INPUTS.json',{'cohortSha256':hashlib.sha256((out/'data/COHORT.json').read_bytes()).hexdigest(),'protocolSha256':hashlib.sha256((out/'PROTOCOL.json').read_bytes()).hexdigest(),'frozen_before_execution':True})
    results={};replicates={};start=time.time()
    for name,c in SCENARIOS.items():
        sim=Simulation(jobs,c,record=True);r=sim.run();results[name]=r
        write_gzip(out/'data'/f'{name}_jobs.jsonl.gz',serialize(sim.rows.values()));write_gzip(out/'data'/f'{name}_events.jsonl.gz',(json.dumps(x,sort_keys=True,separators=(',',':'))+'\n' for x in sim.events))
        rs=[r]
        for k in range(1,args.replicates):rs.append(Simulation(jobs,c,20260922+1009*k).run())
        replicates[name]=rs
        print(name, 'useful',r['useful_settled'],'admitted',r['admitted'],'bad paid',r['paid_bad'],'human hours',round(r['human_hours'],1),flush=True)
    dump(out/'results/CANONICAL.json',results);dump(out/'results/REPLICATES.json',replicates)
    intervals={name:{key:dict(mean=statistics.mean(x[key] for x in rs),p025=percentile([x[key] for x in rs],.025),p975=percentile([x[key] for x in rs],.975)) for key in ['useful_settled','paid_bad','resource_cost_USDC','human_hours','modeled_system_surplus_USDC','node_cash_net_USDC']} for name,rs in replicates.items()}
    dump(out/'results/MONTE_CARLO.json',intervals)
    sensitivities=[]
    for key,values in [('human_hours',[1,2,4,8]),('gas_multiplier',[.25,1,5,12.5]),('compute_multiplier',[.5,1,2,4]),('common_error',[0,.025,.10,.20]),('active_cap',[3,10,20,40])]:
        for value in values:
            c=dict(BASE,**{key:value});r=Simulation(jobs,c).run();sensitivities.append(dict(parameter=key,value=value,**{k:r[k] for k in ['admitted','useful_settled','paid_bad','human_hours','resource_cost_USDC','node_cash_net_USDC','modeled_system_surplus_USDC']}))
    dump(out/'results/SENSITIVITY.json',sensitivities)
    paired={name:{key:dict(mean=statistics.mean(ds:=[x[key]-b[key] for x,b in zip(rs,replicates['qualified_8x4'])]),p025=percentile(ds,.025),p975=percentile(ds,.975)) for key in ['useful_settled','paid_bad','resource_cost_USDC','human_hours','modeled_system_surplus_USDC']} for name,rs in replicates.items() if name!='qualified_8x4'}
    dump(out/'results/PAIRED_DIFFERENCES.json',paired)
    dump(out/'evidence/RUN.json',dict(scenarios=len(SCENARIOS),offers_per_scenario=N,canonical_offer_evaluations=len(SCENARIOS)*N,replicated_offer_evaluations=len(SCENARIOS)*N*args.replicates,sensitivity_offer_evaluations=len(sensitivities)*N,seconds=round(time.time()-start,3),all_money_conservation_checks_passed=True))
    print('Completed in',round(time.time()-start,2),'seconds',flush=True)
if __name__=='__main__':main()
