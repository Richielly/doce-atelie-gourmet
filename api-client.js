/* Doce Ateliê — cliente da API v0.1.0. Não armazene códigos de provisionamento neste arquivo. */
export class DoceAtelieAPI {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    if (!/^https:\/\//.test(this.baseUrl) && !/^http:\/\/localhost(?::\d+)?$/.test(this.baseUrl)) throw new Error("Use HTTPS ou localhost");
  }
  async request(path,{method="GET",body,token,signal}={}) {
    let response;
    try { response=await fetch(this.baseUrl+path,{
      method,signal,
      headers:{"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{}),...(token?{"Authorization":"Bearer "+token}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    }); } catch {
      const error=new Error('Não foi possível conectar a '+this.baseUrl+'. Verifique a internet e o endereço do servidor. Se ele mudou, use Atualizar endereço na loja salva.');
      error.code='NETWORK_ERROR';throw error;
    }
    let data;
    try { data=await response.json(); } catch { data=null; }
    if(!response.ok) { const error=new Error(typeof data?.detail==='string'?data.detail:data?.detail?JSON.stringify(data.detail):'Erro HTTP '+response.status);error.status=response.status;throw error; }
    return data;
  }
  catalog(shopId,options={}){return this.request("/public/shops/"+encodeURIComponent(shopId),options);}
  identity(shopId,options={}){return this.request("/public/shops/"+encodeURIComponent(shopId)+"/identity",options);}
  placeOrder(shopId,items){return this.request("/public/shops/"+encodeURIComponent(shopId)+"/orders",{method:"POST",body:{items}});}
  orderStatus(shopId,orderId,token){return this.request("/public/shops/"+encodeURIComponent(shopId)+"/orders/"+encodeURIComponent(orderId)+"?token="+encodeURIComponent(token));}
  challenge(shopId,publicKey){return this.request("/auth/shops/"+encodeURIComponent(shopId)+"/challenge",{method:"POST",body:publicKey?{public_key:publicKey}:{}});}
  activate(shopId,code,publicKey){return this.request("/auth/shops/"+encodeURIComponent(shopId)+"/activate",{method:"POST",body:{code,public_key:publicKey}});}
  session(shopId,challengeId,nonce,signature){return this.request("/auth/shops/"+encodeURIComponent(shopId)+"/session",{method:"POST",body:{challenge_id:challengeId,nonce,signature}});}
  products(shopId,token){return this.request("/admin/shops/"+encodeURIComponent(shopId)+"/products",{token});}
  createProduct(shopId,token,product){return this.request("/admin/shops/"+encodeURIComponent(shopId)+"/products",{method:"POST",token,body:product});}
  updateProduct(shopId,token,productId,product){return this.request("/admin/shops/"+encodeURIComponent(shopId)+"/products/"+encodeURIComponent(productId),{method:"PUT",token,body:product});}
  updateBranding(shopId,token,branding){return this.request("/admin/shops/"+encodeURIComponent(shopId)+"/branding",{method:"PUT",token,body:{branding}});}
  orders(shopId,token){return this.request("/admin/shops/"+encodeURIComponent(shopId)+"/orders",{token});}
  setOrderStatus(shopId,token,orderId,status){return this.request("/admin/shops/"+encodeURIComponent(shopId)+"/orders/"+encodeURIComponent(orderId)+"/status",{method:"PUT",token,body:{status}});}
  audit(shopId,token){return this.request("/admin/shops/"+encodeURIComponent(shopId)+"/audit",{token});}
}
