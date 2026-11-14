"use client";

import * as React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Summary = { user_id: string; day: string; name: string; first_seen: string; last_seen: string; unique_bookings: number; booking_visits: number; pages: number; active_seconds: number; incomplete: boolean };
type Event = { id: string; user_id: string; name: string; kind: 'browsing' | 'action'; at: string; until?: string; page: string; pathname?: string; booking?: string; section?: string; dialog?: string; state?: string; tab?: string; incomplete?: boolean; action?: string; details?: string };
const date = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time = (value: string) => new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));
const duration = (seconds: number) => `${Math.floor(seconds/3600)}h ${Math.floor(seconds%3600/60)}m ${Math.floor(seconds%60)}s`;

export function BrowsingHistory() {
  const [members,setMembers]=React.useState<{id:string;name:string}[]>([]);
  const [draft,setDraft]=React.useState({from:date(),to:date(),user:'',page:'',booking:''});
  const [filters,setFilters]=React.useState(draft);
  const [offset,setOffset]=React.useState(0);
  const [refresh,setRefresh]=React.useState(0);
  const [result,setResult]=React.useState<{summary:Summary[];events:Event[]}>({summary:[],events:[]});
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState('');
  React.useEffect(()=>{let cancelled=false; void supabase.rpc('get_admin_live_roster').then(({data,error})=>{if(!cancelled&&!error)setMembers(data??[]);});return()=>{cancelled=true;};},[]);
  React.useEffect(()=>{
    const controller=new AbortController(); let cancelled=false;
    setLoading(true); setError('');
    void (async()=>{
      try {
        const {data,error}=await supabase.rpc('get_admin_browsing_history',{p_from:filters.from,p_to:filters.to,p_user:filters.user||null,p_page:filters.page.trim()||null,p_booking:filters.booking.trim()||null,p_offset:offset}).abortSignal(controller.signal);
        if(error)throw error;
        if(!cancelled)setResult(data);
      }catch{if(!cancelled){setResult({summary:[],events:[]});setError('History could not be loaded. Check the date range and try again.');}}
      finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;controller.abort();};
  },[filters,offset,refresh]);
  const apply=(event:React.FormEvent)=>{event.preventDefault();setOffset(0);setFilters({...draft});setRefresh(n=>n+1);};
  return <Card>
    <CardHeader><CardTitle>Browsing history</CardTitle><CardDescription>90 days of recorded admin navigation. Visible only to your account. Times are in India Standard Time.</CardDescription></CardHeader>
    <CardContent className="space-y-5">
      <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div><Label htmlFor="history-from">From</Label><Input id="history-from" type="date" required value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/></div>
        <div><Label htmlFor="history-to">To</Label><Input id="history-to" type="date" required value={draft.to} min={draft.from} onChange={e=>setDraft({...draft,to:e.target.value})}/></div>
        <div><Label htmlFor="history-user">Admin</Label><select id="history-user" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.user} onChange={e=>setDraft({...draft,user:e.target.value})}><option value="">All admins</option>{members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        <div><Label htmlFor="history-page">Page</Label><Input id="history-page" placeholder="Reservations" maxLength={160} value={draft.page} onChange={e=>setDraft({...draft,page:e.target.value})}/></div>
        <div><Label htmlFor="history-booking">Booking ID</Label><Input id="history-booking" placeholder="A10372" maxLength={40} value={draft.booking} onChange={e=>setDraft({...draft,booking:e.target.value})}/></div>
        <Button type="submit" className="self-end" disabled={loading}>Apply / refresh</Button>
      </form>
      <p className="text-xs text-muted-foreground">Active time means a visible, focused tab with interaction in the previous five minutes. Overlapping tabs are counted once per user. First and last observed are not login/logout times. Missing reports are marked incomplete; history starts after rollout.</p>
      {error?<p role="alert">{error}</p>:null}
      {loading?<p role="status">Loading history…</p>:<>
        {!result.summary.length?<p className="text-sm text-muted-foreground">No browsing records for these filters.</p>:null}
        {result.summary.map(s=><details key={`${s.user_id}:${s.day}`} className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm"><strong>{s.name}</strong> · {s.day} · {duration(s.active_seconds)} active · {s.unique_bookings} unique bookings · {s.booking_visits} booking visits{s.incomplete?' · Incomplete reporting':''}</summary>
          <div className="mt-3 space-y-2 text-sm"><p>First observed: {time(s.first_seen)}<br/>Last observed: {time(s.last_seen)}<br/>{s.pages} distinct pages visited</p><Button variant="outline" size="sm" onClick={()=>{const next={...filters,from:s.day,to:s.day,user:s.user_id};setDraft(next);setFilters(next);setOffset(0);}}>Show this user’s timeline</Button></div>
        </details>)}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-3 text-left font-medium">Timeline · browsing observations and existing recorded actions</caption><thead><tr>{['Date / time','Admin','Page / booking','Activity','Duration'].map(label=><th key={label} scope="col" className="border-b p-2">{label}</th>)}</tr></thead>
          <tbody>{result.events.slice(0,50).map(e=><tr key={`${e.kind}:${e.id}`}><td className="border-b p-2 whitespace-nowrap">{time(e.at)}</td><td className="border-b p-2">{e.name}</td><td className="border-b p-2">{e.page}{e.booking?` · ${e.booking}`:''}{e.pathname?<span className="block text-xs text-muted-foreground">{e.pathname}</span>:null}</td><td className="border-b p-2">{e.kind==='action'?<><strong>Recorded action: {e.action}</strong><p>{e.details}</p></>:<>{e.state} · Tab {e.tab}{e.section?<p>Section: {e.section}</p>:null}{e.dialog?<p>{e.dialog} dialog open</p>:null}{e.incomplete?<p className="text-muted-foreground">Incomplete reporting</p>:null}</>}</td><td className="border-b p-2 whitespace-nowrap">{e.until?duration(Math.max(0,(Date.parse(e.until)-Date.parse(e.at))/1000)):'—'}</td></tr>)}</tbody></table></div>
        <div className="flex items-center gap-3"><Button variant="outline" disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Previous</Button><span className="text-sm">Page {offset/50+1}</span><Button variant="outline" disabled={result.events.length<=50} onClick={()=>setOffset(n=>n+50)}>Next</Button></div>
      </>}
    </CardContent>
  </Card>;
}
