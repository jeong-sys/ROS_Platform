## 초기화
- 불가피한 상황에서 kubeadm 초기화 방법
```
sudo kubeadm reset -f
sudo systemctl stop kubelet
sudo systemctl stop docker
sudo rm -rf /etc/cni/
sudo rm -rf /var/lib/kubelet/*
sudo systemctl start kubelet
```
- CNI(calico) 초기화 방법
```
rm -rf /var/run/calico/
rm -rf /var/lib/calico/
rm -rf /etc/cni/net.d/
rm -rf /var/lib/cni/
```

## 인증서 오류
- 토큰 인증 후 과정 거친후에도 오류 발생 시, 기존 인증서 문제
- 기존 파일 지워주는 과정 필요
```
sudo rm -rf /home/yj/.kube/ 
```
- 지운 후 진행
```
mkdir -p $HOME/.kube
sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config
```

## coredns pending 오류
https://nirsa.tistory.com/292
- calico의 경우 CNI 설치 제대로 되지 않았을 때 발생
```
curl https://docs.projectcalico.org/archive/v3.8/manifests/calico.yaml -O
```
```
kubectl apply -f calico.yaml
```

## calico 0/1 running 오류
https://velog.io/@koo8624/Kubernetes-Calico-Error-caliconode-is-not-ready-BIRD-is-not-ready-BGP-not-established
- 179번 방화벽 허용 (모든 노드에서 진행)
```
sudo firewall-cmd --permanent --zone=public --add-port=179/tcp
```
```
sudo firewall-cmd --reload
```