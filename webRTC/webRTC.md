## WebRTC
참고 자료 : https://gh402.tistory.com/38
- 앱/웹에서 별다른 소프트웨어(드라이버나 플러그인 설치) 없이 카메라, 마이크등을 사용하여 실시간 커뮤니케이션을 제공하는 기술
- 웹 브라우저만 있어도 리얼타임 커뮤니케이션 가능
- P2P방식으로 동등 계층 간 클라이언트/서버 개념 없이 동등 노드들로 구성되어 데이터 상호작용이 가능함

### 동작 원리
참고 자료 : https://velog.io/@happyjarban/WebRTC-%ED%8C%8C%ED%97%A4%EC%B9%98%EA%B8%B01-WebRTC-%EC%9D%B4%EB%A1%A0
1. 각 브라우저 P2P 커뮤니케이션
2. 서로의 주소 공유
3. 보안 사항 및 방화벽 우회
4. 실시간 데이터 공유

<img src=https://velog.velcdn.com/images%2Fhappyjarban%2Fpost%2F7f5a9c7f-9dde-424e-9b85-70acb90345c1%2Fimage.png>

- NAT 방화벽 우회를 위한 서버 필요
    - STUN : Client가 공인 IP 얻을 수 있도록 도와줌, 클라이언트들이 서로에게 직접 연결이 가능하도록 외부에서 접근 가능한 주소를 알려주는 역할
    - TURN : P2P 연결 실패시 중계 서버 역할

- Signalling
    - P2P 연결 설정을 위해 서로의 네트워크 정보 교환에 사용
    - WebSocket, HTTP 요청으로 구현 가능

