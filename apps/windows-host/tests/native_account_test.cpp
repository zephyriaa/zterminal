#include "native_account.h"
#include <future>
#include <iostream>
#include <cassert>
#include <ws2tcpip.h>

int main() {
    using namespace zterminal::native_account;
    auto require=[](bool ok,const char* name){if(!ok){std::cerr<<"FAIL "<<name<<'\n';std::exit(1);}std::cout<<"PASS "<<name<<'\n';};
    require(challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")=="E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM","RFC 7636 independent S256 vector");
    auto state=random_token(),code=random_token();require(state.size()==43&&state!=code,"independent unpredictable values");
    auto valid="GET /native/callback?state="+state+"&code="+code+" HTTP/1.1\r\nHost: 127.0.0.1:51000\r\n\r\n";
    require(callback_code(valid,state,"127.0.0.1:51000")==code,"exact callback accepted");
    require(callback_code(valid,code,"127.0.0.1:51000").empty(),"wrong state rejected");
    require(callback_code(valid,state,"127.0.0.1:51001").empty(),"wrong callback owner rejected");
    auto duplicate=valid;duplicate.insert(duplicate.find(" HTTP/1.1"),"&state="+state);require(callback_code(duplicate,state,"127.0.0.1:51000").empty(),"duplicate state rejected");
    auto hostile=valid;hostile.insert(hostile.size()-2,"Origin: https://hostile.invalid\r\n");require(callback_code(hostile,state,"127.0.0.1:51000").empty(),"browser script origin rejected");
    require(callback_code("GET /native/callback?state="+state+"&error=access_denied HTTP/1.1\r\nHost: 127.0.0.1:51000\r\n\r\n",state,"127.0.0.1:51000")=="access_denied","explicit denial retained");
    auto root=L"TEST-ONLY-"+std::wstring(state.begin(),state.end());
    require(credentials(root).empty(),"isolated credential initially absent");save_credentials(root,"TEST ONLY opaque credential");
    require(credentials(root)=="TEST ONLY opaque credential","Credential Manager round trip");require(credentials(root+L"-other").empty(),"storage roots isolated");erase_credentials(root);require(credentials(root).empty(),"isolated credential removed");
    Flow flow;require(flow.authorization_url().find(std::wstring(flow.verifier.begin(),flow.verifier.end()))==std::wstring::npos,"verifier never in browser URL");
    auto wait=std::async(std::launch::async,[&]{try{flow.wait();return false;}catch(std::exception const&){return true;}});flow.cancel();require(wait.get(),"cancel stops listener wait without success");
    Flow socketFlow;auto expected=random_token();
    auto received=std::async(std::launch::async,[&]{return socketFlow.wait();});
    auto host=socketFlow.redirect_uri.substr(7);host.resize(host.find('/'));
    SOCKET client=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP);sockaddr_in address{};address.sin_family=AF_INET;address.sin_addr.s_addr=htonl(INADDR_LOOPBACK);address.sin_port=htons(u_short(std::stoi(host.substr(host.find(':')+1))));
    require(connect(client,reinterpret_cast<sockaddr*>(&address),sizeof(address))==0,"real callback socket connects to owned loopback endpoint");
    auto callback="GET /native/callback?state="+socketFlow.state+"&code="+expected+" HTTP/1.1\r\nHost: "+host+"\r\n\r\n";
    require(send(client,callback.data(),int(callback.size()),0)==int(callback.size()),"real callback request sent");char reply[512]{};auto length=recv(client,reply,sizeof(reply),0);closesocket(client);
    require(length>0&&std::string(reply,length).starts_with("HTTP/1.1 200 OK"),"real callback receives acknowledgement");require(received.get()==expected,"real listener returns exact validated code");
    std::cout<<"Native account security checks complete; no external service or browser used\n";
}
