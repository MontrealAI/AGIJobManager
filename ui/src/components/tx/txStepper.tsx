'use client';
export function TxStepper({step,error}:{step:string;error?:string}){
  return <div className='text-xs space-y-1'><div>Step: {step}</div>{error&&<div className='text-destructive'>{error}</div>}</div>;
}
