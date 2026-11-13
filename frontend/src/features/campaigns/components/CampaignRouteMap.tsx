"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export type RouteStop = { date:string; start:string; ward:string; detail:string; day:number; activity:number };
type Point = { lon:number; lat:number; label:string };
type PhotonFeature = { properties:{name?:string;state?:string;city?:string;countrycode?:string;osm_key?:string;osm_value?:string};geometry:{coordinates:number[]} };
const geocodeCache = new Map<string,Point>();
const normalize = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
const wardName = (value:string) => value.replace(/^(xã|phường|thị trấn)\s+/i,'');
const provinceName = (value:string) => value.replace(/^(tỉnh|thành phố)\s+/i,'').replace(/\s+(province|city)$/i,'');
const sleep = (ms:number) => new Promise<void>(resolve=>setTimeout(resolve,ms));

async function geocode(ward:string,province:string,signal:AbortSignal):Promise<Point> {
 const cacheKey=`${ward}|${province}`;const cached=geocodeCache.get(cacheKey);if(cached)return cached;
 const query=`${wardName(ward)} ${provinceName(province)}`;
 const url=new URL('/geocode-location',window.location.origin);url.searchParams.set('q',query);
 const response=await fetch(url,{signal});if(!response.ok)throw new Error('Không thể tìm địa điểm. Vui lòng thử lại sau.');
 const data=await response.json() as {features?:PhotonFeature[]};
 const expectedWard=normalize(wardName(ward));const expectedProvince=normalize(provinceName(province));
 const candidates=data.features?.filter(feature=>normalize(wardName(feature.properties.name||''))===expectedWard && [feature.properties.state,feature.properties.city].some(name=>normalize(provinceName(name||''))===expectedProvince) && (feature.properties.countrycode||'').toLowerCase()==='vn')||[];
 const match=candidates.find(feature=>feature.properties.osm_key==='boundary'&&feature.properties.osm_value==='administrative')||candidates.find(feature=>feature.properties.osm_value!=='historic');
 if(!match||!Array.isArray(match.geometry.coordinates)||match.geometry.coordinates.length<2)throw new Error(`Không tìm thấy vị trí khớp xã/phường ${ward}, ${province} trên dữ liệu OpenStreetMap. Vui lòng kiểm tra lại tên địa điểm.`);
 const [lon,lat]=match.geometry.coordinates;if(!Number.isFinite(lon)||!Number.isFinite(lat))throw new Error(`Tọa độ của ${ward} không hợp lệ.`);
 const point={lon,lat,label:match.properties.name||ward};geocodeCache.set(cacheKey,point);return point;
}

export default function CampaignRouteMap({stops,province,autoShow=true}:{stops:RouteStop[];province:string;autoShow?:boolean}) {
 const mapRef=useRef<HTMLDivElement>(null),mapInstance=useRef<Leaflet.Map|null>(null),abortRef=useRef<AbortController|null>(null);
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const stopKey=JSON.stringify({stops,province});
 useEffect(()=>{setStatus('');return ()=>{abortRef.current?.abort();mapInstance.current?.remove();mapInstance.current=null;};},[stopKey]);
 async function showLocations(){
  if(!stops.length||!mapRef.current)return;
  if(stops.length>50){setStatus('Bản thử nghiệm hỗ trợ tối đa 50 hoạt động.');return;}
  const controller=new AbortController();abortRef.current=controller;setBusy(true);setStatus('Đang tìm vị trí các hoạt động…');
  try{
   const points:{point:Point;stop:RouteStop}[]=[];const missing:RouteStop[]=[];let lastRequest=0;
   for(const stop of stops){
    if(controller.signal.aborted)return;
    const cached=geocodeCache.has(`${stop.ward}|${province}`);
    if(!cached&&lastRequest){const delay=1100-(Date.now()-lastRequest);if(delay>0)await sleep(delay);}
    if(controller.signal.aborted)return;
    if(!cached)lastRequest=Date.now();
    try{points.push({point:await geocode(stop.ward,province,controller.signal),stop});}catch{if(controller.signal.aborted)return;missing.push(stop);}
   }
   if(controller.signal.aborted)return;
   mapInstance.current?.remove();mapInstance.current=null;
   if(points.length){
    const L=await import('leaflet');if(controller.signal.aborted||!mapRef.current)return;
    const map=L.map(mapRef.current);mapInstance.current=map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}).addTo(map);
    const grouped=new Map<string,{point:Point;stops:RouteStop[]}>();
    points.forEach(({point,stop})=>{const key=`${point.lat},${point.lon}`;const group=grouped.get(key);if(group)group.stops.push(stop);else grouped.set(key,{point,stops:[stop]});});
    grouped.forEach(({point,stops:items})=>{const marker=L.circleMarker([point.lat,point.lon],{radius:8,color:'#205c43',weight:3,fillColor:'#fff',fillOpacity:1}).addTo(map);const content=document.createElement('div');items.forEach(stop=>{const line=document.createElement('div');line.textContent=`Ngày ${stop.day} · Hoạt động ${stop.activity}: ${stop.ward} (${stop.start})`;content.appendChild(line);});marker.bindPopup(content);marker.bindTooltip(items.map(stop=>`Ngày ${stop.day} · HĐ ${stop.activity}`).join(', '),{direction:'top'});});
    map.fitBounds(L.latLngBounds(points.map(({point})=>[point.lat,point.lon] as Leaflet.LatLngTuple)),{padding:[35,35],maxZoom:14});
   }
   setStatus(missing.length?`Không tìm được vị trí: ${missing.map(stop=>`ngày ${stop.day}, hoạt động ${stop.activity} (${stop.ward})`).join('; ')}. Vui lòng kiểm tra tên địa điểm.`:'Đã hiển thị các địa điểm hoạt động trên bản đồ.');
  }catch{if(!controller.signal.aborted)setStatus('Không thể hiển thị bản đồ. Vui lòng thử lại.');}finally{if(!controller.signal.aborted)setBusy(false);}
 }
 useEffect(()=>{if(autoShow)void showLocations();},[autoShow,stopKey]);
 return <div><p className="muted">Các điểm là vị trí xã/phường ước lượng, chưa phải địa chỉ cụ thể.</p>{stops.length===0&&<p className="notice">Chưa có hoạt động có địa điểm để hiển thị.</p>}
 <ol className="ow-route-stops">{stops.map((stop,i)=><li key={i}><strong>Ngày {stop.day} · Hoạt động {stop.activity}: {stop.ward}, {province}</strong><small>{stop.date} · {stop.start} · {stop.detail}</small></li>)}</ol>{status&&<p className="notice" role="status">{status}</p>}<div ref={mapRef} className="ow-route-map" hidden={!stops.length} aria-label="Bản đồ địa điểm hoạt động"/><small>Dữ liệu © OpenStreetMap contributors. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Góp ý dữ liệu bản đồ</a>.</small></div>;
}

