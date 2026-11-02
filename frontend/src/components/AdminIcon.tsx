import { CSSProperties } from "react";
const paths = {
 grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
 folder: "M3 7V5h6l2 3h10v12H3z M3 12h18",
 clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
 check: "m8 12 3 3 5-6 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
 edit: "m14 5 5 5 M4 20l1-6L17 2l5 5L10 19z",
 arrow: "M5 12h14 m-6-6 6 6-6 6",
 refresh: "M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 3 M19 16a8 8 0 0 1-13 3l-2-3",
 search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
 user: "M4 21v-3a8 8 0 0 1 16 0v3 M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
 shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6z m-4 10 3 3 5-6",
 logout: "M9 3H3v18h6 M8 12h13 m-5-5 5 5-5 5",
 globe: "M2 12h20 M12 2c-6 5-6 15 0 20 6-5 6-15 0-20 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
 close: "m6 6 12 12 M6 18 18 6",
 menu: "M3 6h18 M3 12h18 M3 18h18",
};
export default function AdminIcon({name, size=20, style}:{name:keyof typeof paths;size?:number;style?:CSSProperties}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]}/></svg>;
}
