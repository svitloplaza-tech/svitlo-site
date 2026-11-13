// Ідентифікатори аналітики (публічні, не секрети). Акаунт Google: svitloplaza@gmail.com.
export const GA_ID = "G-V2RW855TKW"; // Google Analytics 4, ресурс «svitloplaza.store»
export const CLARITY_ID = "zcyato5sm8"; // Microsoft Clarity, проєкт «Svitlo Plaza»
export const CONSENT_KEY = "sp-consent-v1";

// Вставляється в <head> (layout.tsx) до gtag.js: згода за замовчуванням — denied, якщо відвідувач ще не прийняв.
export const GA_INIT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;var c=null;try{c=localStorage.getItem('${CONSENT_KEY}')}catch(e){}var g=c==='granted'?'granted':'denied';gtag('consent','default',{analytics_storage:g,ad_storage:g,ad_user_data:g,ad_personalization:g,wait_for_update:500});gtag('js',new Date());gtag('config','${GA_ID}');`;
