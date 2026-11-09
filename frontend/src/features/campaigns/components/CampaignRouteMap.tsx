"use client";
import { useEffect, useRef, useState } from "react";

type Stop = { date: string; start: string; ward: string; detail: string };
type MapsApi = { importLibrary(name:string):Promise<unknown> };
type MapInstance = { fitBounds(bounds:unknown):void };
type Bounds = { extend(point:unknown):void };
type RouteResult = { distanceMeters?:number; path?:unknown[]; createPolylines():{setMap(map:MapInstance|null):void}[] };
type MapsLibrary = { Map:new(element:HTMLElement,options:unknown)=>MapInstance };
type CoreLibrary = { LatLngBounds:new()=>Bounds };
type RoutesLibrary = { Route:{ computeRoutes(request:unknown):Promise<{routes?:RouteResult[]}> } };
declare global { interface Window { google?: { maps: MapsApi }; gm_authFailure?:()=>void } }
let mapsPromise:Promise<MapsApi>|undefined;
function loadMaps(key:string):Promise<MapsApi> {
 if(window.google?.maps?.importLibrary)return Promise.resolve(window.google.maps);
 if(mapsPromise)return mapsPromise;
 mapsPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=vi`;
  script.async=true;
  const timeout=window.setTimeout(()=>{script.remove();mapsPromise=undefined;reject(new Error('Tải Google Maps quá thời gian.'));},15000);
  script.onerror=()=>{window.clearTimeout(timeout);script.remove();mapsPromise=undefined;reject(new Error('Không tải được Google Maps.'));};
  script.onload=()=>{window.clearTimeout(timeout);if(window.google?.maps?.importLibrary)resolve(window.google.maps);else{script.remove();mapsPromise=undefined;reject(new Error('Google Maps không sẵn sàng.'));}};
  document.head.appendChild(script);
 });return mapsPromise;
}
export default function CampaignRouteMap({stops,province}:{stops:Stop[];province:string}) {
 const mapRef=useRef<HTMLDivElement>(null); const [status,setStatus]=useState('');const [distances,setDistances]=useState<number[]>([]);const [busy,setBusy]=useState(false);
 const key=process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
 useEffect(()=>{setDistances([]);setStatus('');if(mapRef.current)mapRef.current.replaceChildren();},[stops,province]);
 async function calculate(){
  if(!key||stops.length<2||!mapRef.current)return;setBusy(true);setStatus('Đang tính tuyến đường...');setDistances([]);
  try{
   const api=await loadMaps(key);
   const [maps,core,routes]=await Promise.all([api.importLibrary('maps') as Promise<MapsLibrary>,api.importLibrary('core') as Promise<CoreLibrary>,api.importLibrary('routes') as Promise<RoutesLibrary>]);
   const map=new maps.Map(mapRef.current,{center:{lat:21.8,lng:105.8},zoom:7});const bounds=new core.LatLngBounds();const values:number[]=[];let hasPath=false;
   for(let i=0;i<stops.length-1;i++){
    const from=`${stops[i].ward}, ${province}, Việt Nam`,to=`${stops[i+1].ward}, ${province}, Việt Nam`;
    if(from===to){values.push(0);continue;}
    const result=await routes.Route.computeRoutes({origin:from,destination:to,travelMode:'DRIVING',fields:['path','distanceMeters']});
    const route=result.routes?.[0];if(!route||route.distanceMeters==null||!route.path?.length)throw new Error(`Không tìm được tuyến từ ${stops[i].ward} đến ${stops[i+1].ward}.`);
    route.createPolylines().forEach(line=>line.setMap(map));route.path.forEach(point=>bounds.extend(point));hasPath=true;values.push(route.distanceMeters);
   }
   if(hasPath)map.fitBounds(bounds);setDistances(values);setStatus(hasPath?'':'Các điểm đã chọn cùng xã/phường; không có quãng đường giữa các điểm.');
  }catch(error){setStatus(error instanceof Error?error.message:'Không thể tính tuyến đường.');setDistances([]);}finally{setBusy(false);}
 }
 return <div><p className="muted">Tuyến đường ô tô theo thứ tự ngày và giờ; dùng tên xã/phường và tỉnh, chưa dùng địa chỉ cụ thể.</p>{stops.length<2?<p className="notice">Cần ít nhất hai hoạt động có xã/phường để tính tuyến đường.</p>:!key?<p className="notice">Chưa cấu hình Google Maps API key. Danh sách điểm vẫn được hiển thị để kiểm tra.</p>:<button type="button" onClick={()=>void calculate()} disabled={busy}>{busy?'Đang tính...':'Vẽ tuyến và tính quãng đường'}</button>}
 <ol className="ow-route-stops">{stops.map((stop,i)=><li key={i}><strong>{stop.ward}, {province}</strong><small>{stop.date} · {stop.start} · {stop.detail}</small>{i>0&&distances.length===stops.length-1&&<span>Quãng đường từ điểm trước: {(distances[i-1]/1000).toLocaleString('vi-VN',{maximumFractionDigits:1})} km</span>}</li>)}</ol>{status&&<p className="notice" role="status">{status}</p>}{distances.length>0&&<p><strong>Tổng quãng đường: {(distances.reduce((a,b)=>a+b,0)/1000).toLocaleString('vi-VN',{maximumFractionDigits:1})} km</strong></p>}<div ref={mapRef} className="ow-route-map" hidden={!key||stops.length<2} aria-label="Bản đồ tuyến đường"/></div>;
}
