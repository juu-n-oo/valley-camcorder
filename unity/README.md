# Valley Camcorder · Unity

Unity Hub에서 이 `unity` 폴더를 추가하고 **Unity 6000.6.9f1**로 엽니다. Project 창의 **Assets → Valley → Scenes → HwayangValley**를 열고 **Play**를 누릅니다. 처음 열 때는 URP와 지형·시설 메시를 가져옵니다.

| 키 | 동작 |
| --- | --- |
| 클릭, 마우스 | 화면에 커서를 고정하고 시점 이동 |
| WASD, Shift, Ctrl, Space | 걷기, 달리기, 앉기, 점프 |
| Z | 깊은 물에서 잠수 전환 |
| H, E, T | 물건 들기·내려놓기, 문과 손잡이 조작, 물건 던지기 |
| F, R | 연습장 왕복, 재보급 |
| Esc | 마우스 고정 해제 |

## 편집과 내보내기

- Unity에서 씬의 지형, 숲, 도로와 시설, 상호작용 개체, 카메라를 편집합니다. 씬의 이동 가능 영역은 기존 지도 외곽선과 도로 차단점에서 가져옵니다. 원경에는 계곡 양쪽의 능선과 물길을 이어 붙였습니다.
- [Blender 원본](../blender/valley-assets.blend)에는 계곡의 암반과 건축 재질, 숙소 시설, 소나타, 야영 식기, 손 리그가 있습니다. 손 모델은 다음 명령으로 다시 내보냅니다. 다른 모델도 `-- --collection "컬렉션 이름"`을 붙여 FBX로 가져올 수 있습니다.

```powershell
blender --background blender/valley-assets.blend --python-exit-code 1 --python blender/export-unity.py
```

- 재현 기준이 되는 웹 지도와 Blender 내보내기 파일을 갱신한 다음, 저장소 루트에서 아래 명령으로 Unity 데이터 묶음을 다시 생성합니다. Unity 메뉴 **Valley → Rebuild Imported Valley Scene**은 해당 데이터로 가져오기 씬을 재생성합니다. 씬에서 직접 편집할 때는 다른 이름의 씬에 저장해 편집본을 보관합니다.

```powershell
npm --prefix tools/unity install
npm --prefix tools/unity run export
```

- Windows 빌드는 Unity의 **File → Build Profiles**에서 활성 씬을 포함해 빌드합니다. 배치 빌드의 진입점은 `ValleyCamcorder.Editor.ValleySceneBuilder.BuildWindows`입니다.

2001년 8월 18일과 26일 촬영의 숲 경계, 암반 층리, 자갈과 녹색 수면을 조명과 재질의 기준으로 삼았습니다. 예전 사진을 참고해 만든 계곡 숙소와 세단 메시도 가져옵니다. 걸음과 호흡은 기존 게임에 사용한 사용자 녹음 구간을 Unity 오디오 클립으로 가져옵니다.

이 Unity 버전은 계곡 탐험, 물에서의 이동과 잠수, 소품 취급, 문과 차량 부품 개폐, 연습장의 미니카 놀이를 다룹니다. 완전한 기존 게임 동작의 기준은 루트의 웹 버전입니다. 시설별 전기·가스·급수 반응, 화재와 구조 붕괴, 모든 장비 동작과 효과음의 Unity 이식은 남아 있습니다.
