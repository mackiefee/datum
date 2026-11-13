import { TODAY } from '../config/constants.js';

export const fmt=d=>new Date(d+"T00:00").toLocaleDateString("en-US",{day:"numeric",month:"short"});
export const pl=n=>n===1?"resource":"resources";
export const gPl=(n,w)=>n+" "+(n===1?w[0]:w[1]);
export const days=d=>Math.round((new Date(TODAY)-new Date(d))/864e5);
