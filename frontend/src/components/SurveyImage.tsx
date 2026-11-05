"use client";
import {useEffect,useState} from "react";
import {apiBlob} from "@/lib/api";
export default function SurveyImage({path,alt}:{path:string;alt:string}){
 const [url,setUrl]=useState("");const [error,setError]=useState(false);
 useEffect(()=>{let active=true;let current="";setUrl("");setError(false);apiBlob(path).then(blob=>{if(active){current=URL.createObjectURL(blob);setUrl(current);}}).catch(()=>{if(active)setError(true);});return()=>{active=false;if(current)URL.revokeObjectURL(current);};},[path]);
 return error?<p role="alert">Không tải được ảnh minh chứng.</p>:url?<a href={url} target="_blank" rel="noreferrer" aria-label="Mở ảnh minh chứng"><img src={url} alt={alt}/></a>:<p>Đang tải ảnh…</p>;
}
