/** Bounded scheduling for full qualification tasks; never caches an authorization. */
export class QualificationService {
  constructor({maxConcurrent=4,maxQueued=32,reservedRecovery=1,maxQueueMs=10000,maxTaskMs=30000,clock=Date.now}={}) {
    for(const [n,min,max] of [[maxConcurrent,2,64],[maxQueued,2,10000],[reservedRecovery,1,maxConcurrent-1],[maxQueueMs,1,120000],[maxTaskMs,1,120000]])if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('QUALIFICATION_SERVICE_LIMITS');
    Object.assign(this,{maxConcurrent,maxQueued,reservedRecovery,maxQueueMs,maxTaskMs,clock});
    this.queue=[];this.running=new Map();this.closed=false;this.samples=[];
    this.metrics={submitted:0,completed:0,rejected:0,timedOut:0,failed:0,peakRunning:0,peakQueued:0};
  }
  run(key, task, {priority='intake',deadlineMs=this.clock()+this.maxQueueMs+this.maxTaskMs}={}) {
    this.metrics.submitted++;
    const reject=code=>{this.metrics.rejected++;return Promise.reject(Error(code));};
    if(this.closed)return reject('QUALIFICATION_SERVICE_STOPPED');
    if(typeof key!=='string'||!key.length||key.length>512||typeof task!=='function'||!['intake','recovery'].includes(priority)||!Number.isSafeInteger(deadlineMs))return reject('QUALIFICATION_REQUEST');
    if(deadlineMs<=this.clock())return reject('QUALIFICATION_DEADLINE');
    if(this.running.has(key)||this.queue.some(x=>x.key===key))return reject('QUALIFICATION_ALREADY_RUNNING');
    const capacity=priority==='intake'?this.maxQueued-1:this.maxQueued;
    if(this.queue.length>=capacity)return reject('QUALIFICATION_QUEUE_FULL');
    return new Promise((resolve,reject)=>{
      const entry={key,task,priority,deadlineMs,resolve,reject,queued:this.clock(),controller:new AbortController()};
      entry.queueTimer=setTimeout(()=>{
        const index=this.queue.indexOf(entry);if(index<0)return;
        this.queue.splice(index,1);this.metrics.timedOut++;entry.controller.abort();reject(Error('QUALIFICATION_QUEUE_DEADLINE'));this.drain();
      },Math.max(1,Math.min(this.maxQueueMs,deadlineMs-this.clock())));
      this.queue.push(entry);this.metrics.peakQueued=Math.max(this.metrics.peakQueued,this.queue.length);this.drain();
    });
  }
  drain() {
    if(this.closed)return;
    while(this.running.size<this.maxConcurrent&&this.queue.length){
      const intake=Array.from(this.running.values()).filter(x=>x.priority==='intake').length;
      let index=this.queue.findIndex(x=>x.priority==='recovery');
      if(index<0){if(intake>=this.maxConcurrent-this.reservedRecovery)return;index=0;}
      const entry=this.queue.splice(index,1)[0];clearTimeout(entry.queueTimer);
      if(entry.deadlineMs<=this.clock()){this.metrics.timedOut++;entry.reject(Error('QUALIFICATION_DEADLINE'));continue;}
      this.start(entry);
    }
  }
  start(entry) {
    this.running.set(entry.key,entry);this.metrics.peakRunning=Math.max(this.metrics.peakRunning,this.running.size);
    const started=this.clock();let settled=false;
    const timer=setTimeout(()=>{if(settled)return;settled=true;this.metrics.timedOut++;entry.controller.abort();entry.reject(Error('QUALIFICATION_TASK_DEADLINE'));},Math.max(1,Math.min(this.maxTaskMs,entry.deadlineMs-started)));
    Promise.resolve().then(()=>entry.task(entry.controller.signal)).then(result=>{
      if(settled)return;
      if(this.closed||entry.controller.signal.aborted){this.metrics.rejected++;entry.reject(Error('QUALIFICATION_SERVICE_STOPPED'));}
      else if(this.clock()>=entry.deadlineMs||this.clock()-started>=this.maxTaskMs){this.metrics.timedOut++;entry.reject(Error('QUALIFICATION_TASK_DEADLINE'));}
      else {this.metrics.completed++;entry.resolve(result);}
      settled=true;
    },error=>{if(!settled){settled=true;this.metrics.failed++;entry.reject(error);}}).finally(()=>{
      clearTimeout(timer);this.running.delete(entry.key);this.samples.push({queueMs:started-entry.queued,taskMs:this.clock()-started,totalMs:this.clock()-entry.queued,priority:entry.priority});if(this.samples.length>4096)this.samples.shift();this.drain();
    });
  }
  snapshot() {
    const percentile=(name,p)=>{const values=this.samples.map(x=>x[name]).sort((a,b)=>a-b);return values.length?values[Math.ceil(values.length*p)-1]:null;};
    return {...this.metrics,running:this.running.size,queued:this.queue.length,retainedLatencySamples:this.samples.length,
      latencyMs:{p50:percentile('totalMs',.5),p95:percentile('totalMs',.95),p99:percentile('totalMs',.99)},
      limits:{maxConcurrent:this.maxConcurrent,maxQueued:this.maxQueued,reservedRecovery:this.reservedRecovery,maxQueueMs:this.maxQueueMs,maxTaskMs:this.maxTaskMs}};
  }
  close() {
    this.closed=true;
    for(const entry of this.queue){clearTimeout(entry.queueTimer);this.metrics.rejected++;entry.reject(Error('QUALIFICATION_SERVICE_STOPPED'));}this.queue=[];
    for(const entry of this.running.values())entry.controller.abort();
  }
}
