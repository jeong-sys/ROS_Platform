### WebRTC
- https://wormwlrm.github.io/2021/01/24/Introducing-WebRTC.html
- https://velog.io/@yyong3519/WebRTC-%EA%B5%AC%ED%98%84%EC%98%88%EC%A0%9C1

### 외부 사이트 카메라 권한 허용 방법 
- chrome://flags/ 접속
- Insecure origins treated as secure 에서 ip 추가 후 사용 가능으로 변경

### 카메라 접속 불가
- https://andonekwon.tistory.com/59

#### STUN Server만 있는 경우, 영상이 보이지 않는 문제
- 두 Client가 같은 네트워크에 존재하고 있을 때 보이지 않음.
- NAT 환경에서는 Symmetric NAT 경우, 어플리케이션이 달라지면 NAT의 매핑테이블이 바뀔 수 있음
- 이를 위해서는 TURN Sever 필요

#### 서로 다른, ip 사용 시 영상 확인 가능(양방향)
- PC(1) 에서 서버 실행
- PC(1) 에서 내부 IP로 접속
- PC(2) 에서 외부 IP로 접속
- commit



