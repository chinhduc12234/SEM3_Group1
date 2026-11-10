"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

export type RouteStop = { date:string; start:string; ward:string; detail:string };
export type RouteSummary = { key:string; distances:number[]; snapDistances:number[] };
type Point = { lon:number; lat:number; label:string };
type RouteLeg = { geometry:{coordinates:number[][]}; distance:number };
type PhotonFeature = { properties:{name?:string;state?:string;countrycode?:string};geometry:{coordinates:number[]} };
const geocodeCache = new Map<string,Point>();
const normalize = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]/g,'');
const wardName = (value:string) => value.replace(/^(xã|phường|thị trấn)\s+/i,'');
const provinceName = (value:string) => value.replace(/^(tỉnh|thành phố)\s+/i,'').replace(/\s+(province|city)$/i,'');
const sleep = (ms:number) => new Promise<void>(resolve=>setTimeout(resolve,ms));

async function geocode(ward:string,province:string,signal:AbortSignal):Promise<Point> {
 const cacheKey=`${ward}|${province}`;const cached=geocodeCache.get(cacheKey);if(cached)return cached;
 const query=`${wardName(ward)} ${provinceName(province)}`;
 const url=new URL('https://photon.komoot.io/api/');url.searchParams.set('q',query);url.searchParams.set('limit','10');url.searchParams.set('lang','en');
 const response=await fetch(url,{signal});if(!response.ok)throw new Error('Không thể tìm địa điểm. Vui lòng thử lại sau.');
 const data=await response.json() as {features?:PhotonFeature[]};
 const expectedWard=normalize(wardName(ward));const expectedProvince=normalize(provinceName(province));
 const match=data.features?.find(feature=>normalize(feature.properties.name||'')===expectedWard && normalize(provinceName(feature.properties.state||''))===expectedProvince && (feature.properties.countrycode||'').toLowerCase()==='vn');
 if(!match||!Array.isArray(match.geometry.coordinates)||match.geometry.coordinates.length<2)throw new Error(`Không tìm thấy vị trí khớp xã/phường ${ward}, ${province} trên dữ liệu OpenStreetMap. Vui lòng kiểm tra lại tên địa điểm.`);
 const [lon,lat]=match.geometry.coordinates;if(!Number.isFinite(lon)||!Number.isFinite(lat))throw new Error(`Tọa độ của ${ward} không hợp lệ.`);
 const point={lon,lat,label:match.properties.name||ward};geocodeCache.set(cacheKey,point);return point;
}

export default function CampaignRouteMap({stops,province,onResult}:{stops:RouteStop[];province:string;onResult:(result:RouteSummary|null)=>void}) {
 const mapRef=useRef<HTMLDivElement>(null),mapInstance=useRef<Leaflet.Map|null>(null),abortRef=useRef<AbortController|null>(null);
 const [status,setStatus]=useState(''),[distances,setDistances]=useState<number[]>([]),[snapDistances,setSnapDistances]=useState<number[]>([]),[busy,setBusy]=useState(false);
 const stopKey=JSON.stringify({stops,province});
 useEffect(()=>{setDistances([]);setSnapDistances([]);setStatus('');return ()=>{abortRef.current?.abort();mapInstance.current?.remove();mapInstance.current=null;};},[stopKey]);
 async function calculate(){
  if(stops.length<2||!mapRef.current)return;
  if(stops.length>50){setStatus('Bản thử nghiệm hỗ trợ tối đa 50 điểm trong một tuyến.');return;}
  const controller=new AbortController();abortRef.current=controller;setBusy(true);setStatus('Đang tìm vị trí và tính tuyến đường…');setDistances([]);setSnapDistances([]);onResult(null);
  try{
   const points:Point[]=[];let lastRequest=0;
   for(const stop of stops){
    if(controller.signal.aborted)return;
    const isCached=geocodeCache.has(`${stop.ward}|${province}`);
    if(!isCached&&lastRequest){const delay=1100-(Date.now()-lastRequest);if(delay>0)await sleep(delay);}
    if(controller.signal.aborted)return;
    if(!isCached)lastRequest=Date.now();points.push(await geocode(stop.ward,province,controller.signal));
   }
   const snappedPoints:Point[]=[];let lastRoutingRequest=0;
   for(let index=0;index<points.length;index++){
    if(controller.signal.aborted)return;
    const coordinates=`${points[index].lon},${points[index].lat};${points[index].lon},${points[index].lat}`;
    const response=await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordinates}?overview=false&steps=false`,{signal:controller.signal});
    if(!response.ok)throw new Error('Dịch vụ tìm đường tạm thời không phản hồi. Vui lòng thử lại.');
    const data=await response.json() as {code:string;waypoints?:{location:number[];distance:number}[]};
    const waypoint=data.waypoints?.[0];
    if(data.code!=='Ok'||!waypoint||waypoint.location?.length!==2||!waypoint.location.every(Number.isFinite)||!Number.isFinite(waypoint.distance))throw new Error(`Không thể đưa điểm ${index+1} (${stops[index].ward}) vào mạng lưới đường.`);
    snappedPoints.push({lon:waypoint.location[0],lat:waypoint.location[1],label:stops[index].ward});
    if(index>0){
     const delay=1100-(Date.now()-lastRoutingRequest);if(delay>0)await sleep(delay);
     if(controller.signal.aborted)return;
    }
    lastRoutingRequest=Date.now();
   }
   const legs:RouteLeg[]=[];
   for(let index=0;index<snappedPoints.length-1;index++){
    if(controller.signal.aborted)return;
    const from=snappedPoints[index],to=snappedPoints[index+1];
    const coordinates=`${from.lon},${from.lat};${to.lon},${to.lat}`;
    const response=await fetch(`https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`,{signal:controller.signal});
    if(!response.ok)throw new Error('Dịch vụ tìm đường tạm thời không phản hồi. Vui lòng thử lại.');
    const data=await response.json() as {code:string;routes?:{geometry:{coordinates:number[][]};legs:{distance:number}[]}[]};
    const route=data.routes?.[0],leg=route?.legs[0];
    if(data.code!=='Ok'||!route?.geometry?.coordinates?.length||!leg||!Number.isFinite(leg.distance))throw new Error(`Không tìm được tuyến đường từ ${stops[index].ward} đến ${stops[index+1].ward}.`);
    legs.push({geometry:route.geometry,distance:leg.distance});
    if(index<snappedPoints.length-2){
     const delay=1100-(Date.now()-lastRoutingRequest);if(delay>0)await sleep(delay);
     if(controller.signal.aborted)return;
    }
    lastRoutingRequest=Date.now();
   }
   const L=await import('leaflet');if(controller.signal.aborted||!mapRef.current)return;
   mapInstance.current?.remove();const map=L.map(mapRef.current);mapInstance.current=map;
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}).addTo(map);
   const lines=legs.map((leg,index)=>L.polyline(leg.geometry.coordinates.map(([lon,lat])=>[lat,lon] as Leaflet.LatLngTuple),{color:'#205c43',weight:5}).addTo(map));
   points.forEach((point,index)=>{
    const snapped=snappedPoints[index],origin:L.LatLngTuple=[point.lat,point.lon],road:L.LatLngTuple=[snapped.lat,snapped.lon];
    L.polyline([origin,road],{color:'#d4773a',weight:3,dashArray:'5 6'}).addTo(map);
    const marker=L.circleMarker(origin,{radius:8,color:'#205c43',weight:3,fillColor:'#fff',fillOpacity:1}).addTo(map);
    marker.bindTooltip(`Ngày ${index+1}: ${stops[index].ward}`,{permanent:true,direction:'top',offset:[0,-8],className:'ow-route-day-tooltip'});
    if(L.latLng(origin).distanceTo(L.latLng(road))>25){const roadMarker=L.circleMarker(road,{radius:4,color:'#d4773a',weight:2,fillColor:'#fff',fillOpacity:1}).addTo(map);roadMarker.bindTooltip(`Điểm nối đường ${index+1}: ${stops[index].ward}`);}
   });
   const bounds=L.latLngBounds(points.map(point=>[point.lat,point.lon] as Leaflet.LatLngTuple));lines.forEach(line=>bounds.extend(line.getBounds()));
   map.fitBounds(bounds,{padding:[35,35],maxZoom:14});const distances=legs.map(leg=>leg.distance),snapDistances=points.map((point,index)=>L.latLng(point.lat,point.lon).distanceTo(L.latLng(snappedPoints[index].lat,snappedPoints[index].lon)));setDistances(distances);setSnapDistances(snapDistances);onResult({key:stopKey,distances,snapDistances});setStatus('Đường liền nối theo thứ tự ngày giữa các xã/phường; nét đứt nối từng xã/phường với đường ô tô gần nhất. Nhãn Ngày N đánh dấu vị trí hoạt động.');
  }catch(error){if(!controller.signal.aborted){setStatus(error instanceof Error?error.message:'Không thể tính tuyến đường.');setDistances([]);}}finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <div><p className="muted">Tuyến ô tô theo thứ tự ngày và giờ; dùng vị trí xã/phường ước lượng, chưa dùng địa chỉ cụ thể.</p>{stops.length<2?<p className="notice">Cần ít nhất hai hoạt động có xã/phường để tính tuyến đường.</p>:<button type="button" onClick={()=>void calculate()} disabled={busy}>{busy?'Đang tính...':'Vẽ tuyến và tính quãng đường'}</button>}
 <ol className="ow-route-stops">{stops.map((stop,i)=><li key={i}><strong>Ngày {i+1}: {stop.ward}, {province}</strong><small>{stop.date} · {stop.start} · {stop.detail}</small>{snapDistances.length===stops.length&&<small>Điểm nối vào đường cách tâm xã/phường ước lượng {(snapDistances[i]/1000).toLocaleString('vi-VN',{maximumFractionDigits:1})} km</small>}{i>0&&distances.length===stops.length-1&&<span>Chặng Ngày {i} → Ngày {i+1}: {(distances[i-1]/1000).toLocaleString('vi-VN',{maximumFractionDigits:1})} km</span>}</li>)}</ol>{status&&<p className="notice" role="status">{status}</p>}{distances.length>0&&<p><strong>Tổng quãng đường các chặng: {(distances.reduce((a,b)=>a+b,0)/1000).toLocaleString('vi-VN',{maximumFractionDigits:1})} km</strong></p>}<div ref={mapRef} className="ow-route-map" hidden={stops.length<2} aria-label="Bản đồ tuyến đường"/><small>Dữ liệu © OpenStreetMap contributors; tìm vị trí bằng Photon và tìm đường bằng dịch vụ thử nghiệm FOSSGIS/OSRM. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Góp ý dữ liệu bản đồ</a>.</small></div>;
}
