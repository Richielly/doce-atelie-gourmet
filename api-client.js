/* Doce Ateliê — cliente da API v0.1.0. Não armazene códigos de provisionamento neste arquivo. */
export class DoceAtelieAPI {
  constructor(baseUrl) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    if (!/^https:\/\//.test(this.baseUrl) && !/^http:\/\/localhost(?::\d+)?$/.test(this.baseUrl)) throw new Error("Use HTTPS ou localhost");
  }
  async request(path,{method="GET",body,token}={}) {
    const response=await fetch(this.baseUrl+path,{
      method,
      headers:{"Accept":"application/json",...(body?{"Content-Type":"application/json"}:{}),...(token?{"Authorization":"Bearer "+token}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    let data;
    try { data=await response.json(); } catch { data=null; }
    if(!response.ok) throw new Error(data?.detail ? JSON.stringify(data.detail) : "Erro HTTP "+response.status);
    return data;
  }
  catalog(shopId){return this.request("/public/shops/"+encodeURIComponent(shopId));}
  placeOrder(shopId,items){return this.request("/public/shops/"+encodeURIComponent(shopId)+"/orders",{method:"POST",body:{items}});}
  orderStatus(shopId,orderId,token){return this.request("/public/shops/"+encodeURIComponent(shopId)+"/orders/"+encodeURIComponent(orderId)+"?token="+encodeURIComponent(token));}
  challenge(shopId){return this.request("/auth/shops/"+encodeURIComponent(shopId)+"/challenge",{method:"POST"});}
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
