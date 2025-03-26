/**
 * recommendationReasons.js
 * 
 * 사용자 특성(MBTI, 관심사, 재능, 감정)을 기반으로 개인화된 추천 이유를 생성하는 유틸리티
 * 추천 결과에 대한 사용자 이해를 높이고 추천의 투명성을 제공합니다.
 */

// MBTI 유형별 색상 맵핑
const mbtiColorMap = {
  'ENFJ': '#4E79A7', 'ENFP': '#F28E2B', 'ENTJ': '#E15759', 'ENTP': '#76B7B2',
  'ESFJ': '#59A14F', 'ESFP': '#EDC948', 'ESTJ': '#B07AA1', 'ESTP': '#FF9DA7',
  'INFJ': '#9C755F', 'INFP': '#BAB0AC', 'INTJ': '#8CD17D', 'INTP': '#D4A6C8',
  'ISFJ': '#86BCB6', 'ISFP': '#F1CE63', 'ISTJ': '#D37295', 'ISTP': '#A0CBE8'
};

// MBTI 유형별 핵심 특성
const mbtiTraits = {
  // 외향형(E) vs 내향형(I)
  'E': {
    traits: ['사교적', '활동적', '에너지 넘치는', '외부 활동 선호', '다양한 경험 추구'],
    placePreferences: ['활기찬', '사람 많은', '사교적인', '다양한 경험', '개방적인']
  },
  'I': {
    traits: ['차분한', '조용한', '깊이 있는', '내면 활동 선호', '집중적 경험 추구'],
    placePreferences: ['조용한', '여유로운', '사색적인', '프라이빗한', '깊이 있는']
  },
  
  // 직관형(N) vs 감각형(S)
  'N': {
    traits: ['추상적', '패턴 발견', '미래 지향적', '창의적', '아이디어 중심'],
    placePreferences: ['창의적인', '독특한', '새로운', '영감을 주는', '비전통적인']
  },
  'S': {
    traits: ['현실적', '구체적', '실용적', '경험 중심', '세부사항 중시'],
    placePreferences: ['전통적인', '검증된', '세련된', '실용적인', '편안한']
  },
  
  // 사고형(T) vs 감정형(F)
  'T': {
    traits: ['논리적', '객관적', '분석적', '진실 추구', '원칙 중심'],
    placePreferences: ['체계적인', '효율적인', '기능적인', '합리적인', '명확한']
  },
  'F': {
    traits: ['감성적', '공감적', '조화 추구', '가치 중심', '인간 관계 중시'],
    placePreferences: ['따뜻한', '정감 있는', '조화로운', '인간적인', '감성적인']
  },
  
  // 판단형(J) vs 인식형(P)
  'J': {
    traits: ['계획적', '체계적', '결정 중심', '목표 지향적', '질서 추구'],
    placePreferences: ['깔끔한', '계획적인', '전통적인', '안정적인', '예측 가능한']
  },
  'P': {
    traits: ['유연한', '적응적', '과정 중심', '탐색 지향적', '개방성 추구'],
    placePreferences: ['자유로운', '즉흥적인', '융통성 있는', '탐색적인', '개방적인']
  }
};

// MBTI 유형별 상세 설명
const mbtiDetailedTraits = {
  // 외향형 + 직관형
  'EN': {
    traits: ['열정적', '사교적', '창의적', '다양한 관심사', '미래 지향적'],
    placePreferences: ['활기찬', '창의적인', '다양한', '새로운 경험', '사람들과 교류']
  },
  // 외향형 + 감각형
  'ES': {
    traits: ['활동적', '사실적', '현실적', '즐거움 추구', '다양한 경험'],
    placePreferences: ['활기찬', '실용적인', '감각적인', '즐거운', '역동적인']
  },
  // 내향형 + 직관형
  'IN': {
    traits: ['독창적', '사색적', '아이디어 탐구', '복잡성 선호', '내면의 세계'],
    placePreferences: ['조용한', '영감을 주는', '독특한', '깊이 있는', '사색적인']
  },
  // 내향형 + 감각형
  'IS': {
    traits: ['차분한', '신중한', '세부사항 중시', '전통 존중', '실용적'],
    placePreferences: ['조용한', '차분한', '세련된', '전통적인', '프라이빗한']
  },
  
  // 외향형 + 사고형
  'ET': {
    traits: ['결단력 있는', '주도적', '논리적', '체계적', '실행력 있는'],
    placePreferences: ['효율적인', '잘 구성된', '활동적인', '도전적인', '기능적인']
  },
  // 외향형 + 감정형
  'EF': {
    traits: ['친근한', '열정적', '조화 추구', '타인 지향적', '사교적'],
    placePreferences: ['따뜻한', '사람 중심의', '활기찬', '사교적인', '즐거운']
  },
  // 내향형 + 사고형
  'IT': {
    traits: ['분석적', '독립적', '객관적', '지식 추구', '논리적'],
    placePreferences: ['조용한', '체계적인', '집중할 수 있는', '기능적인', '논리적인']
  },
  // 내향형 + 감정형
  'IF': {
    traits: ['이해심 깊은', '공감적', '개인 가치 중시', '조화 추구', '내면적'],
    placePreferences: ['따뜻한', '진정성 있는', '조용한', '인간적인', '의미 있는']
  },
  
  // 직관형 + 사고형
  'NT': {
    traits: ['논리적', '전략적', '혁신적', '지적 호기심', '비판적 사고'],
    placePreferences: ['혁신적인', '도전적인', '지적인', '체계적인', '독특한']
  },
  // 직관형 + 감정형
  'NF': {
    traits: ['이상주의적', '영감을 주는', '의미 추구', '창의적', '공감적'],
    placePreferences: ['영감을 주는', '의미 있는', '창의적인', '따뜻한', '독특한']
  },
  // 감각형 + 사고형
  'ST': {
    traits: ['현실적', '논리적', '효율적', '실용적', '결과 지향적'],
    placePreferences: ['실용적인', '효율적인', '검증된', '체계적인', '기능적인']
  },
  // 감각형 + 감정형
  'SF': {
    traits: ['사실적', '친절한', '협력적', '실용적', '세부사항 중시'],
    placePreferences: ['조화로운', '실용적인', '따뜻한', '전통적인', '편안한']
  },
  
  // 직관형 + 판단형
  'NJ': {
    traits: ['비전 있는', '결단력 있는', '목표 지향적', '체계적', '전략적'],
    placePreferences: ['체계적인', '혁신적인', '목표 지향적인', '효율적인', '의미 있는']
  },
  // 직관형 + 인식형
  'NP': {
    traits: ['창의적', '호기심 많은', '적응력 있는', '가능성 탐색', '자유로운'],
    placePreferences: ['독특한', '창의적인', '자유로운', '새로운', '영감을 주는']
  },
  // 감각형 + 판단형
  'SJ': {
    traits: ['책임감 있는', '체계적', '세부사항 중시', '전통 존중', '실용적'],
    placePreferences: ['전통적인', '체계적인', '실용적인', '안정적인', '신뢰할 수 있는']
  },
  // 감각형 + 인식형
  'SP': {
    traits: ['자발적', '현실적', '적응력 있는', '실용적', '즐거움 추구'],
    placePreferences: ['실용적인', '자유로운', '감각적인', '즉흥적인', '흥미로운']
  }
};

// 각 MBTI 유형별 추천 이유 템플릿
const mbtiReasonTemplates = {
  // 외향형, 감각형, 사고형, 판단형
  'ESTJ': [
    '{place}는 {mbti} 성향의 당신이 좋아하는 체계적이고 효율적인 분위기를 제공합니다.',
    '실용적이고 구조화된 환경을 선호하는 {mbti} 유형에게 이 장소는 만족스러운 경험을 제공합니다.',
    '책임감 있고 조직적인 {mbti} 성향에 맞게 효율적으로 운영되는 장소입니다.',
    '전통적 가치와 명확한 규칙을 중시하는 {mbti} 유형이 편안함을 느낄 수 있는 곳입니다.'
  ],
  
  // 외향형, 감각형, 사고형, 인식형
  'ESTP': [
    '현재를 즐기고 활동적인 경험을 추구하는 {mbti} 성향에 딱 맞는 장소입니다.',
    '즉흥적이고 에너지 넘치는 {mbti} 유형이 새로운 자극을 찾을 수 있는 곳입니다.',
    '실용적이고 현실적인 {mbti} 성향의 당신에게 직접적이고 활기찬 경험을 제공합니다.',
    '적응력이 뛰어나고 문제 해결에 능한 {mbti} 유형이 즐길 수 있는 다양한 활동이 있습니다.'
  ],
  
  // 외향형, 감각형, 감정형, 판단형
  'ESFJ': [
    '사람들과의 조화와 따뜻한 관계를 중시하는 {mbti} 성향에 적합한 사교적인 분위기입니다.',
    '배려심 깊고 협력적인 {mbti} 유형이 타인을 돌보고 함께할 수 있는 장소입니다.',
    '전통적 가치와 소속감을 중요시하는 {mbti} 성향에 맞는 편안한 환경을 제공합니다.',
    '사회적 교류와 화합을 좋아하는 {mbti} 유형에게 만족스러운 경험이 될 것입니다.'
  ],
  
  // 외향형, 감각형, 감정형, 인식형
  'ESFP': [
    '자발적이고 열정적인 {mbti} 성향이 즐길 수 있는 활기차고 재미있는 분위기입니다.',
    '현재 순간을 즐기고 사교적인 {mbti} 유형에게 새롭고 흥미로운 경험을 제공합니다.',
    '감각적 즐거움과 다양한 경험을 추구하는 {mbti} 성향의 당신에게 자유롭고 재미있는 시간이 될 것입니다.',
    '사람들과 어울리며 삶을 즐기는 {mbti} 유형이 만족할 만한 활기찬 장소입니다.'
  ],
  
  // 외향형, 직관형, 사고형, 판단형
  'ENTJ': [
    '효율적이고 체계적인 환경을 선호하는 {mbti} 성향에 적합한 전략적 장소입니다.',
    '목표 지향적이고 결단력 있는 {mbti} 유형이 리더십을 발휘할 수 있는 분위기입니다.',
    '논리적이고 미래 지향적인 {mbti} 성향의 당신에게 도전적이고 자극적인 경험을 제공합니다.',
    '혁신적 아이디어와 효율성을 중시하는 {mbti} 유형에게 적합한 분위기와 환경을 갖추고 있습니다.'
  ],
  
  // 외향형, 직관형, 사고형, 인식형
  'ENTP': [
    '지적 호기심이 넘치고, 새로운 아이디어를 탐구하는 {mbti} 성향이 즐길 수 있는 독특한 장소입니다.',
    '창의적이고 도전을 즐기는 {mbti} 유형에게 다양하고 흥미로운 경험을 제공합니다.',
    '논쟁과 토론을 즐기는 {mbti} 성향의 당신에게 지적 자극을 줄 수 있는 분위기입니다.',
    '관습에 얽매이지 않고 혁신적인 {mbti} 유형이 새로운 가능성을 발견할 수 있는 곳입니다.'
  ],
  
  // 외향형, 직관형, 감정형, 판단형
  'ENFJ': [
    '사람들을 이끌고 영감을 주는 것을 좋아하는 {mbti} 성향에 적합한 조화로운 분위기입니다.',
    '타인의 성장을 돕고 공감하는 {mbti} 유형이 의미 있는 관계를 형성할 수 있는 장소입니다.',
    '이상적이고 사람 중심적인 {mbti} 성향의 당신에게 따뜻하고 의미 있는 경험을 제공합니다.',
    '조화와 진정성을 중시하는 {mbti} 유형이 가치 있는 시간을 보낼 수 있는 곳입니다.'
  ],
  
  // 외향형, 직관형, 감정형, 인식형
  'ENFP': [
    '열정적이고 창의적인 {mbti} 성향이 즐길 수 있는 자유롭고 영감을 주는 분위기입니다.',
    '다양한 가능성을 탐색하고 새로운 연결을 만드는 {mbti} 유형에게 독특한 경험을 제공합니다.',
    '사람들과의 진정한 관계와 자기표현을 중시하는 {mbti} 성향의 당신에게 즐겁고 의미 있는 시간이 될 것입니다.',
    '호기심이 많고 모험적인 {mbti} 유형이 새로운 아이디어를 발견할 수 있는 장소입니다.'
  ],
  
  // 내향형, 감각형, 사고형, 판단형
  'ISTJ': [
    '체계적이고 안정적인 환경을 선호하는 {mbti} 성향에 적합한 질서 있는 장소입니다.',
    '신뢰성과 일관성을 중시하는 {mbti} 유형이 편안함을 느낄 수 있는 분위기입니다.',
    '세부 사항에 주의를 기울이고 현실적인 {mbti} 성향의 당신에게 실용적이고 효율적인 경험을 제공합니다.',
    '전통과 책임감을 중요시하는 {mbti} 유형에게 안정감을 주는 환경입니다.'
  ],
  
  // 내향형, 감각형, 사고형, 인식형
  'ISTP': [
    '논리적이고 분석적인 사고를 즐기는 {mbti} 성향에 맞는 실용적인 장소입니다.',
    '독립적이고 적응력이 뛰어난 {mbti} 유형이 자유롭게 탐색할 수 있는 환경입니다.',
    '효율적이고 실용적인 해결책을 찾는 {mbti} 성향의 당신에게 흥미로운 도전을 제공합니다.',
    '현재 순간에 집중하고 문제 해결에 능한 {mbti} 유형이 기술을 발휘할 수 있는 곳입니다.'
  ],
  
  // 내향형, 감각형, 감정형, 판단형
  'ISFJ': [
    '따뜻하고 안정적인 환경을 선호하는 {mbti} 성향에 적합한 편안한 장소입니다.',
    '배려심이 깊고 헌신적인 {mbti} 유형이 타인을 돌볼 수 있는 분위기입니다.',
    '세부 사항에 주의를 기울이고 전통을 존중하는 {mbti} 성향의 당신에게 익숙하고 안정적인 경험을 제공합니다.',
    '실용적이고 지원적인 {mbti} 유형이 편안함을 느낄 수 있는 환경입니다.'
  ],
  
  // 내향형, 감각형, 감정형, 인식형
  'ISFP': [
    '미적 감각이 뛰어나고 조화를 추구하는 {mbti} 성향에 맞는 아름다운 장소입니다.',
    '자유롭고 독립적인 {mbti} 유형이 자신의 가치에 따라 행동할 수 있는 환경입니다.',
    '현재 순간을 즐기고 감각적 경험을 중시하는 {mbti} 성향의 당신에게 즐겁고 아름다운 경험을 제공합니다.',
    '개인적 표현과 진정성을 중요시하는 {mbti} 유형이 만족할 만한 분위기입니다.'
  ],
  
  // 내향형, 직관형, 사고형, 판단형
  'INTJ': [
    '독립적이고 전략적 사고를 즐기는 {mbti} 성향에 적합한 지적인 장소입니다.',
    '혁신적이고 통찰력 있는 {mbti} 유형이 복잡한 문제를 탐구할 수 있는 환경입니다.',
    '효율성과 지식을 중시하는 {mbti} 성향의 당신에게 독창적이고 심층적인 경험을 제공합니다.',
    '미래를 내다보고 체계적으로 계획하는 {mbti} 유형이 영감을 얻을 수 있는 곳입니다.'
  ],
  
  // 내향형, 직관형, 사고형, 인식형
  'INTP': [
    '논리적이고 분석적인 사고를 즐기는 {mbti} 성향에 맞는 지적 탐구의 장소입니다.',
    '독창적이고 호기심 많은 {mbti} 유형이 복잡한 이론과 아이디어를 탐색할 수 있는 환경입니다.',
    '지적 자율성과 이해를 추구하는 {mbti} 성향의 당신에게 흥미롭고 사색적인 경험을 제공합니다.',
    '혁신적이고 개방적인 사고를 가진 {mbti} 유형이 새로운 관점을 발견할 수 있는 곳입니다.'
  ],
  
  // 내향형, 직관형, 감정형, 판단형
  'INFJ': [
    '깊이 있는 통찰과 의미 있는 연결을 추구하는 {mbti} 성향에 적합한 영감을 주는 장소입니다.',
    '이상적이고 직관적인 {mbti} 유형이 자신의 비전을 실현할 수 있는 분위기입니다.',
    '타인과의 깊은 관계와 개인적 성장을 중시하는 {mbti} 성향의 당신에게 의미 있고 진정성 있는 경험을 제공합니다.',
    '조화와 목적을 추구하는 {mbti} 유형이 영감을 얻고 성찰할 수 있는 공간입니다.'
  ],
  
  // 내향형, 직관형, 감정형, 인식형
  'INFP': [
    '개인적 가치와 이상을 추구하는 {mbti} 성향에 적합한 영감을 주는 장소입니다.',
    '창의적이고 사색적인 {mbti} 유형이 자신의 내면을 탐색할 수 있는 분위기입니다.',
    '진정성과 의미 있는 경험을 중시하는 {mbti} 성향의 당신에게 깊은 만족감을 줄 수 있는 환경입니다.',
    '개방적이고 비전통적인 아이디어를 수용하는 {mbti} 유형이 영감을 얻을 수 있는 공간입니다.'
  ]
};

// 감정 상태별 추천 이유 템플릿
const moodReasonTemplates = {
  'happy': [
    '현재 기쁨을 느끼는 당신의 기분을 더욱 고조시켜줄 활기찬 분위기의 장소입니다.',
    '긍정적인 감정 상태인 지금, 당신의 에너지와 잘 어울리는 밝고 즐거운 공간입니다.',
    '행복한 기분을 함께 나누고 더 즐겁게 만들어줄 수 있는 장소입니다.',
    '기쁨의 감정과 잘 어울리는 활기차고 생동감 있는 환경을 제공합니다.'
  ],
  
  'sad': [
    '슬픔을 느끼는 지금, 따뜻하고 편안한 위로를 받을 수 있는 포근한 분위기의 장소입니다.',
    '감정적으로 위로가 필요한 당신에게 안정감을 줄 수 있는 고요하고 아늑한 공간입니다.',
    '조용한 사색과 감정 정화에 도움이 되는 평화로운 환경을 제공합니다.',
    '우울한 기분을 달래주고 마음의 안정을 찾는 데 도움이 될 수 있는 장소입니다.'
  ],
  
  'stressed': [
    '스트레스를 느끼는 당신에게 긴장을 풀고 휴식을 취할 수 있는 편안한 환경을 제공합니다.',
    '현재 느끼는 압박감에서 벗어나 마음의 여유를 찾을 수 있는 평화로운 공간입니다.',
    '스트레스 해소에 도움이 되는 조용하고 안정적인 분위기의 장소입니다.',
    '일상의 긴장감에서 벗어나 재충전할 수 있는 힐링 공간을 제공합니다.'
  ],
  
  'excited': [
    '설렘과 기대감이 가득한 지금, 당신의 에너지와 잘 어울리는 활기찬 장소입니다.',
    '새로운 경험과 모험을 추구하는 당신의 흥분된 감정을 더욱 고조시켜줄 수 있는 공간입니다.',
    '특별한 경험을 기대하는 당신에게 새롭고 자극적인 환경을 제공합니다.',
    '긍정적인 에너지가 넘치는 당신의 기분에 맞는 즐겁고 역동적인 분위기를 갖추고 있습니다.'
  ],
  
  'relaxed': [
    '편안하고 여유로운 감정 상태를 유지하고 싶은 당신에게 적합한 평화로운 환경을 제공합니다.',
    '현재의 평온한 기분을 더욱 깊게 만끽할 수 있는 고요하고 조화로운 분위기입니다.',
    '여유롭고 차분한 시간을 보내고 싶은 당신에게 안정감을 주는 장소입니다.',
    '마음의 평온함을 유지하면서 편안하게 시간을 보낼 수 있는 분위기를 갖추고 있습니다.'
  ],
  
  'bored': [
    '지루함을 느끼는 당신에게 새로운 자극과 새로운 경험을 제공할 수 있는 장소입니다.',
    '호기심을 자극하고 흥미로운 발견이 가능한 독특한 분위기의 공간입니다.',
    '새롭고 다양한 경험을 통해 지루함을 떨치고 활력을 되찾을 수 있는 환경을 제공합니다.',
    '창의적 영감과 흥미로운 대화가 오가는 자극적인 분위기를 갖추고 있습니다.'
  ],
  
  'tired': [
    '피곤함을 느끼는 지금, 쉬고 에너지를 충전할 수 있는 편안한 장소입니다.',
    '신체적, 정신적 피로를 풀고 휴식을 취하기에 적합한 아늑한 환경을 제공합니다.',
    '지친 몸과 마음을 위로하고 재충전할 수 있는 차분한 분위기의 공간입니다.',
    '편안한 좌석과 차분한 분위기로 피로를 풀고 회복할 수 있는 장소입니다.'
  ],
  
  'hungry': [
    '배고픔을 느끼는 지금, 맛있는 음식으로 당신의 식욕을 만족시켜줄 수 있는 장소입니다.',
    '다양한 맛과 풍미로 당신의 배고픔을 해소하기에 최적의 공간입니다.',
    '퀄리티 높은 음식과 만족스러운 식사 경험을 제공하는 곳입니다.',
    '배고파하는 당신에게 포만감과 함께 즐거운 식사 경험을 선사할 수 있는 장소입니다.'
  ],
  
  'romantic': [
    '로맨틱한 감정을 느끼는 지금, 특별한 사람과의 시간을 더욱 빛나게 해줄 분위기 있는 장소입니다.',
    '따뜻하고 친밀한 대화가 오가기 좋은 로맨틱한 환경을 제공합니다.',
    '특별한 순간을 기억에 남게 만들어줄 아름답고 로맨틱한 분위기를 갖추고 있습니다.',
    '소중한 사람과 의미 있는 시간을 보내기에 완벽한 로맨틱한 공간입니다.'
  ],
  
  'neutral': [
    '다양한 감정 상태에 잘 어울리는 균형 잡힌 분위기의 장소입니다.',
    '특별한 감정 상태에 상관없이 편안하게 즐길 수 있는 중립적인 환경을 제공합니다.',
    '어떤 상황이나 기분에도 적합한 유연하고 친화적인 분위기를 갖추고 있습니다.',
    '편안하고 자연스러운 분위기에서 자신만의 시간을 즐길 수 있는 장소입니다.'
  ]
};

// 관심사별 추천 이유 템플릿
const interestReasonTemplates = {
  '여행': [
    '여행에 관심이 많은 당신을 위한 새롭고 흥미로운 경험을 제공하는 장소입니다.',
    '다양한 문화와 새로운 경험을 좋아하는 당신에게 특별한 여행 같은 경험을 선사합니다.',
    '여행 애호가로서 당신이 즐길 수 있는 독특하고 탐험적인 요소가 있는 곳입니다.',
    '여행자의 호기심을 자극하는 이국적이고 이색적인 분위기를 갖추고 있습니다.'
  ],
  
  '음식': [
    '음식에 관심이 많은 당신을 위한 맛있고 다양한 요리를 제공하는 장소입니다.',
    '미식가적 호기심을 충족시켜줄 수 있는 특별한 메뉴와 맛을 경험할 수 있습니다.',
    '당신의 미식 탐험 성향에 딱 맞는 독특하고 퀄리티 높은 음식 경험을 제공합니다.',
    '음식을 사랑하는 당신에게 새로운 맛의 발견과 만족을 선사할 것입니다.'
  ],
  
  '음악': [
    '음악에 관심이 많은 당신을 위한 좋은 음악과 분위기를 즐길 수 있는 장소입니다.',
    '음악 애호가로서 당신의 취향을 만족시켜줄 수 있는 사운드와 분위기를 제공합니다.',
    '음악을 사랑하는 당신에게 즐거운 청각적 경험을 선사하는 공간입니다.',
    '당신의 음악적 감성을 자극하고 즐겁게 해줄 특별한 분위기를 갖추고 있습니다.'
  ],
  
  '예술': [
    '예술에 관심이 많은 당신을 위한 미적 감각과 창의성이 돋보이는 장소입니다.',
    '예술적 영감을 찾는 당신에게 감각적이고 창의적인 경험을 제공합니다.',
    '예술 애호가로서 당신의 미적 감수성을 자극할 수 있는 분위기와 디자인을 갖추고 있습니다.',
    '당신의 예술적 취향을 만족시켜줄 독특하고 아름다운 공간입니다.'
  ],
  
  '독서': [
    '독서를 즐기는 당신을 위한 편안하고 조용한 분위기의 장소입니다.',
    '책을 사랑하는 당신에게 집중하고 생각에 잠길 수 있는 평화로운 환경을 제공합니다.',
    '독서 애호가로서 당신이 책과 함께 여유로운 시간을 보내기에 적합한 분위기를 갖추고 있습니다.',
    '당신의 독서 취향에 어울리는 지적이고 차분한 분위기의 공간입니다.'
  ],
  
  '영화': [
    '영화에 관심이 많은 당신을 위한 시각적 매력과 스토리텔링이 있는 장소입니다.',
    '영화 애호가로서 당신의 감각을 자극할 수 있는 분위기와 설정을 갖추고 있습니다.',
    '영화적 감성을 가진 당신에게 특별한 장면 같은 경험을 선사할 수 있는 곳입니다.',
    '당신이 좋아하는 영화의 한 장면 같은 감성적이고 시각적인 매력이 있는 공간입니다.'
  ],
  
  '스포츠': [
    '스포츠를 좋아하는 당신을 위한 활동적이고 에너지 넘치는 분위기의 장소입니다.',
    '활동적인 라이프스타일을 가진 당신에게 적합한 역동적인 환경을 제공합니다.',
    '스포츠 애호가로서 당신의 활발한 에너지와 잘 어울리는 분위기를 갖추고 있습니다.',
    '당신의 스포츠적 열정을 공유하고 즐길 수 있는 활기찬 공간입니다.'
  ],
  
  '자연': [
    '자연을 사랑하는 당신을 위한 녹음과 자연적 요소가 있는 장소입니다.',
    '자연 친화적인 당신에게 적합한 평화롭고 자연스러운 환경을 제공합니다.',
    '자연을 좋아하는 당신의 취향에 맞는 그린 요소와 자연적 분위기를 갖추고 있습니다.',
    '당신이 추구하는 자연 친화적 가치와 잘 어울리는 공간입니다.'
  ],
  
  '기술': [
    '기술에 관심이 많은 당신을 위한 혁신적이고 미래지향적인 장소입니다.',
    '최신 트렌드를 좋아하는 당신에게 적합한 모던하고 기술적인 환경을 제공합니다.',
    '기술 애호가로서 당신의 호기심을 자극할 수 있는 현대적인 요소들이 있는 곳입니다.',
    '당신의 기술적 관심사를 충족시켜줄 수 있는 혁신적인 경험을 제공합니다.'
  ],
  
  '쇼핑': [
    '쇼핑을 즐기는 당신을 위한 다양한 상품과 선택의 즐거움을 느낄 수 있는 장소입니다.',
    '쇼핑 애호가로서 당신의 탐색 욕구를 충족시켜줄 수 있는 환경을 제공합니다.',
    '당신의 쇼핑 취향에 맞는 독특하고 매력적인 아이템들을 발견할 수 있는 곳입니다.',
    '쇼핑을 통한 발견과 만족을 추구하는 당신에게 적합한 공간입니다.'
  ],
  
  '게임': [
    '게임을 좋아하는 당신을 위한 재미있고 도전적인 경험을 제공하는 장소입니다.',
    '게임 애호가로서 당신의 전략적 사고와 재미를 충족시킬 수 있는 환경을 제공합니다.',
    '당신의 게임적 성향에 어울리는 재미있고 상호작용적인 요소가 있는 곳입니다.',
    '게임을 통한 즐거움과 도전을 추구하는 당신에게 적합한 공간입니다.'
  ],
  
  '사진': [
    '사진에 관심이 많은 당신을 위한 시각적으로 매력적인 장소입니다.',
    '사진 애호가로서 당신이 멋진 사진을 찍을 수 있는 포토제닉한 환경을 제공합니다.',
    '당신의 사진 취향을 만족시켜줄 수 있는 독특하고 아름다운 요소들이 있는 곳입니다.',
    '사진을 통한 창의적 표현을 즐기는 당신에게 영감을 줄 수 있는 공간입니다.'
  ]
};

// 재능별 추천 이유 템플릿
const talentReasonTemplates = {
  '사진촬영': [
    '사진 찍기에 능숙한 당신이 멋진 사진을 남길 수 있는 포토제닉한 장소입니다.',
    '당신의 사진 기술을 발휘할 수 있는 독특하고 아름다운 구도와 배경을 제공합니다.',
    '사진작가로서의 당신의 눈을 만족시킬 수 있는 시각적으로 매력적인 공간입니다.',
    '당신의 카메라에 담기 좋은 특별한 순간과 장면이 가득한 곳입니다.'
  ],
  
  '글쓰기': [
    '글쓰기에 재능이 있는 당신에게 영감을 주고 사색하기 좋은 조용한 분위기의 장소입니다.',
    '당신의 창작 활동에 도움이 되는 평화롭고 영감을 주는 환경을 제공합니다.',
    '작가로서 당신의 생각을 정리하고 글로 표현하기에 적합한 분위기를 갖추고 있습니다.',
    '당신의 글쓰기 감각을 자극할 수 있는 독특한 이야기와 분위기가 있는 곳입니다.'
  ],
  
  '음악': [
    '음악적 재능이 있는 당신이 음악을 즐기고 감상하기 좋은 음향적 환경을 제공합니다.',
    '당신의 음악적 감각을 만족시켜줄 수 있는 음악과 분위기를 갖추고 있습니다.',
    '음악가로서 당신이 음악적 영감을 얻고 즐길 수 있는 공간입니다.',
    '당신의 음악 재능과 조화를 이루는 청각적으로 매력적인 환경을 제공합니다.'
  ],
  
  '요리': [
    '요리에 재능이 있는 당신이 음식의 품질과 맛을 진정으로 평가할 수 있는 장소입니다.',
    '당신의 요리 감각을 자극하고 새로운 아이디어를 제공할 수 있는 메뉴와 요리법을 제공합니다.',
    '요리사로서 당신이 음식의 재료와 기술을 감상하고 배울 수 있는 공간입니다.',
    '당신의 미식가적 재능을 충족시켜줄 수 있는 퀄리티 높은 요리 경험을 제공합니다.'
  ],
  
  '그림': [
    '그림 그리기에 재능이 있는 당신에게 시각적 영감을 줄 수 있는 아름다운 장소입니다.',
    '당신의 예술적 감각을 자극할 수 있는 색감과, 형태, 빛이 있는 환경을 제공합니다.',
    '화가로서 당신이 스케치하거나 영감을 얻기에 적합한 시각적 매력이 있는 공간입니다.',
    '당신의 그림 재능을 발휘하고 표현하기에 좋은 분위기와 요소들이 있는 곳입니다.'
  ],
  
  '댄스': [
    '춤에 재능이 있는 당신을 위한 리듬감 있고 활기찬 분위기의 장소입니다.',
    '당신의 움직임과 표현 욕구를 충족시켜줄 수 있는 역동적인 환경을 제공합니다.',
    '무용가로서 당신이 즐기고 발견할 수 있는 리듬과 에너지가 있는 공간입니다.',
    '당신의 댄스 재능과 어울리는 음악과 분위기를 갖추고 있습니다.'
  ],
  
  '운동': [
    '운동 능력이 뛰어난 당신을 위한 활동적이고 에너지 넘치는 장소입니다.',
    '당신의 체력과 운동 신경을 활용할 수 있는 다양한 활동과 환경을 제공합니다.',
    '스포츠맨으로서 당신이 활발하게 움직이고 즐길 수 있는 공간입니다.',
    '당신의 운동 재능을 발휘하고 건강한 활동을 즐길 수 있는 환경을 갖추고 있습니다.'
  ],
  
  '공예': [
    '손재주가 뛰어난 당신에게 창의적 영감을 줄 수 있는 디테일한 장소입니다.',
    '당신의 공예 재능을 자극할 수 있는 섬세하고 예술적인 요소들이 있는 환경을 제공합니다.',
    '공예가로서 당신이 아이디어를 얻고 창작 욕구를 느낄 수 있는 공간입니다.',
    '당신의 세심한 관찰력과 손기술을 만족시켜줄 수 있는 세부적인 매력이 있는 곳입니다.'
  ],
  
  '연기': [
    '연기 재능이 있는 당신을 위한 표현력과 감성을 자극하는 장소입니다.',
    '당신의 연기 감각과 표현 욕구를 충족시켜줄 수 있는 드라마틱한 환경을 제공합니다.',
    '배우로서 당신이 다양한 캐릭터와 상황을 상상하고 경험할 수 있는 공간입니다.',
    '당신의 연기 재능을 발휘하고 영감을 얻을 수 있는 특별한 분위기를 갖추고 있습니다.'
  ],
  
  '노래': [
    '노래 부르기에 재능이 있는 당신을 위한 좋은 음향과 분위기를 제공하는 장소입니다.',
    '당신의 보컬 재능을 발휘하거나 즐길 수 있는 음악적 환경을 제공합니다.',
    '가수로서 당신이 음악을 즐기고 감상할 수 있는 특별한 공간입니다.',
    '당신의 노래 실력과 어울리는 음악과 사운드를 갖추고 있습니다.'
  ],
  
  '디자인': [
    '디자인 감각이 뛰어난 당신을 위한 시각적으로 세련되고 아름다운 장소입니다.',
    '당신의 디자인 재능과 미적 감각을 만족시켜줄 수 있는 스타일리시한 환경을 제공합니다.',
    '디자이너로서 당신이 영감을 얻고 평가할 수 있는 독특한 디자인 요소가 있는 공간입니다.',
    '당신의 디자인 안목을 충족시켜줄 수 있는 세련된 인테리어와 구성을 갖추고 있습니다.'
  ],
  
  '코딩': [
    '코딩 능력이 있는 당신을 위한 기술적이고 효율적인 분위기의 장소입니다.',
    '당신의 논리적 사고와 문제 해결 능력을 자극할 수 있는 구조적인 환경을 제공합니다.',
    '프로그래머로서 당신이 집중하고 작업하기에 적합한 기능적인 공간입니다.',
    '당신의 기술적 재능과 혁신적 사고를 지원하는 현대적이고 효율적인 분위기를 갖추고 있습니다.'
  ]
};

/**
 * 장소에 대한 모든 추천 이유를 생성하는 함수
 * (MBTI, 관심사, 재능, 감정 상태 기반)
 * 
 * @param {Object} place - 장소 정보
 * @param {Object} userProfile - 사용자 프로필 정보
 * @returns {Object} - 다양한 카테고리별 추천 이유
 */
export const generateAllReasons = (place, userProfile) => {
  if (!place || !userProfile) {
    return {
      primary: "개인화된 추천 장소입니다.",
      mbti: [],
      interests: [],
      talents: [],
      mood: []
    };
  }
  
  try {
    // MBTI 기반 추천 이유
    const mbtiReasons = generateMbtiReasons(place, userProfile.mbti);
    
    // 관심사 기반 추천 이유
    const interestsReasons = generateInterestReasons(place, userProfile.interests);
    
    // 재능 기반 추천 이유
    const talentsReasons = generateTalentReasons(place, userProfile.talents);
    
    // 감정 상태 기반 추천 이유
    const moodReasons = generateMoodReasons(place, userProfile.currentMood);
    
    // 메인 추천 이유 결정 (가장 매치도가 높은 카테고리 선택)
    const primaryReason = determinePrimaryReason({
      mbti: mbtiReasons.length > 0,
      interests: interestsReasons.length > 0,
      talents: talentsReasons.length > 0,
      mood: moodReasons.length > 0
    }, {
      mbtiScore: place.mbtiMatchScore?.[userProfile.mbti] || 0,
      interestScore: place.interestMatchScore || calculateInterestScore(place, userProfile.interests),
      talentScore: place.talentMatchScore || calculateTalentScore(place, userProfile.talents),
      moodScore: place.moodMatchScore?.[userProfile.currentMood?.mood] || 0,
    }, userProfile);
    
    return {
      primary: primaryReason,
      mbti: mbtiReasons,
      interests: interestsReasons,
      talents: talentsReasons,
      mood: moodReasons
    };
  } catch (error) {
    console.error('추천 이유 생성 오류:', error);
    
    // 오류 발생 시 기본 추천 이유 반환
    return {
      primary: "이 장소가 당신에게 맞을 것 같습니다.",
      mbti: [],
      interests: [],
      talents: [],
      mood: []
    };
  }
};

/**
 * MBTI 기반 추천 이유 생성
 * 
 * @param {Object} place - 장소 정보
 * @param {string} mbtiType - 사용자 MBTI 유형
 * @returns {Array} - MBTI 기반 추천 이유 배열
 */
export const generateMbtiReasons = (place, mbtiType) => {
  if (!place || !mbtiType || mbtiType.length !== 4) {
    return [];
  }
  
  try {
    const reasons = [];
    
    // 해당 MBTI 유형에 맞는 템플릿 선택
    if (mbtiReasonTemplates[mbtiType]) {
      // 장소 이름과 MBTI 유형 정보로 템플릿 변수 바인딩
      const templates = mbtiReasonTemplates[mbtiType];
      
      // 최대 2개의 템플릿 랜덤 선택
      const selectedTemplates = getRandomElements(templates, 2);
      
      selectedTemplates.forEach(template => {
        const reason = template
          .replace('{place}', place.name || '이 장소')
          .replace('{mbti}', mbtiType);
        
        reasons.push(reason);
      });
    }
    
    // MBTI 개별 지표 (E/I, S/N, T/F, J/P) 기반 추가 이유 생성
    let traitsCount = 0;
    
    // 내향/외향 특성
    const attitudeChar = mbtiType.charAt(0); // E 또는 I
    if (mbtiTraits[attitudeChar] && traitsCount < 2) {
      const attitudeTraits = mbtiTraits[attitudeChar];
      const placePreferences = attitudeTraits.placePreferences;
      
      // 장소 태그와 성향 선호 매칭
      const placeTags = place.tags || [];
      const matchingPreferences = placePreferences.filter(pref => 
        placeTags.some(tag => tag.includes(pref.toLowerCase()) || pref.toLowerCase().includes(tag))
      );
      
      if (matchingPreferences.length > 0) {
        const randomPref = matchingPreferences[Math.floor(Math.random() * matchingPreferences.length)];
        const randomTrait = getRandomElement(attitudeTraits.traits);
        
        const reason = attitudeChar === 'E' 
          ? `외향적(${mbtiType})인 당신은 ${randomTrait} 성향을 가지고 있어, 이 장소의 ${randomPref} 분위기와 잘 어울립니다.`
          : `내향적(${mbtiType})인 당신은 ${randomTrait} 성향을 가지고 있어, 이 장소의 ${randomPref} 분위기에서 편안함을 느낄 수 있습니다.`;
        
        reasons.push(reason);
        traitsCount++;
      }
    }
    
    // 인식 방식 특성
    const perceptionChar = mbtiType.charAt(1); // S 또는 N
    if (mbtiTraits[perceptionChar] && traitsCount < 2) {
      const perceptionTraits = mbtiTraits[perceptionChar];
      const randomTrait = getRandomElement(perceptionTraits.traits);
      const randomPref = getRandomElement(perceptionTraits.placePreferences);
      
      const reason = perceptionChar === 'S' 
        ? `감각형(${mbtiType})인 당신은 ${randomTrait} 경향이 있어, 이 장소의 ${randomPref} 특성을 높이 평가할 것입니다.`
        : `직관형(${mbtiType})인 당신은 ${randomTrait} 성향이 있어, 이 장소의 ${randomPref} 요소에 매력을 느낄 수 있습니다.`;
      
      reasons.push(reason);
      traitsCount++;
    }
    
    // 복합 특성 (MBTI 조합별)
    const firstTwo = mbtiType.substring(0, 2); // EI + SN 조합
    if (mbtiDetailedTraits[firstTwo] && traitsCount < 2) {
      const combinedTraits = mbtiDetailedTraits[firstTwo];
      const randomTrait = getRandomElement(combinedTraits.traits);
      const randomPref = getRandomElement(combinedTraits.placePreferences);
      
      const reason = `${mbtiType} 성향의 당신은 ${randomTrait} 특성이 있어, 이 장소의 ${randomPref} 분위기를 특히 즐길 수 있습니다.`;
      
      reasons.push(reason);
    }
    
    return reasons;
  } catch (error) {
    console.error('MBTI 추천 이유 생성 오류:', error);
    return [];
  }
};

/**
 * 관심사 기반 추천 이유 생성
 * 
 * @param {Object} place - 장소 정보
 * @param {Array} interests - 사용자 관심사 배열
 * @returns {Array} - 관심사 기반 추천 이유 배열
 */
export const generateInterestReasons = (place, interests) => {
  if (!place || !interests || !Array.isArray(interests) || interests.length === 0) {
    return [];
  }
  
  try {
    const reasons = [];
    const placeTags = (place.tags || []).map(tag => tag.toLowerCase());
    
    // 장소 태그와 관심사 매칭
    const matchingInterests = interests.filter(interest => {
      const interestLower = interest.toLowerCase();
      return placeTags.some(tag => 
        tag.includes(interestLower) || 
        interestLower.includes(tag) ||
        areRelatedTerms(tag, interestLower)
      );
    });
    
    if (matchingInterests.length === 0) {
      return [];
    }
    
    // 최대 2개의 관심사에 대한 추천 이유 생성
    const selectedInterests = getRandomElements(matchingInterests, 2);
    
    selectedInterests.forEach(interest => {
      // 관심사에 맞는 템플릿 선택
      let templates = interestReasonTemplates[interest];
      
      // 정확한 매치가 없으면 유사 관심사 템플릿 찾기
      if (!templates) {
        // 일부 유사한 키워드에 대해 대체 템플릿 사용
        if (interest.includes('여행') || interest.includes('관광'))
          templates = interestReasonTemplates['여행'];
        else if (interest.includes('음식') || interest.includes('요리') || interest.includes('맛집'))
          templates = interestReasonTemplates['음식'];
        else if (interest.includes('음악') || interest.includes('노래'))
          templates = interestReasonTemplates['음악'];
        else if (interest.includes('예술') || interest.includes('미술') || interest.includes('전시'))
          templates = interestReasonTemplates['예술'];
        else if (interest.includes('책') || interest.includes('독서'))
          templates = interestReasonTemplates['독서'];
        else if (interest.includes('영화') || interest.includes('드라마'))
          templates = interestReasonTemplates['영화'];
        else if (interest.includes('운동') || interest.includes('스포츠'))
          templates = interestReasonTemplates['스포츠'];
        else if (interest.includes('자연') || interest.includes('풍경'))
          templates = interestReasonTemplates['자연'];
        else if (interest.includes('기술') || interest.includes('테크'))
          templates = interestReasonTemplates['기술'];
        else if (interest.includes('쇼핑') || interest.includes('구매'))
          templates = interestReasonTemplates['쇼핑'];
        else if (interest.includes('게임') || interest.includes('놀이'))
          templates = interestReasonTemplates['게임'];
        else if (interest.includes('사진') || interest.includes('카메라'))
          templates = interestReasonTemplates['사진'];
      }
      
      // 적절한 템플릿이 없으면 기본 템플릿 생성
      if (!templates) {
        const reason = `${interest}에 관심이 있는 당신에게 적합한 매력적인 장소입니다.`;
        reasons.push(reason);
      } else {
        // 템플릿에서 랜덤 선택
        const template = getRandomElement(templates);
        reasons.push(template);
      }
    });
    
    return reasons;
  } catch (error) {
    console.error('관심사 추천 이유 생성 오류:', error);
    return [];
  }
};

/**
 * 재능 기반 추천 이유 생성
 * 
 * @param {Object} place - 장소 정보
 * @param {Array} talents - 사용자 재능 배열
 * @returns {Array} - 재능 기반 추천 이유 배열
 */
export const generateTalentReasons = (place, talents) => {
  if (!place || !talents || !Array.isArray(talents) || talents.length === 0) {
    return [];
  }
  
  try {
    const reasons = [];
    const placeTags = (place.tags || []).map(tag => tag.toLowerCase());
    const placeTalents = place.talentRelevance || [];
    
    // 장소 태그/관련 재능과 사용자 재능 매칭
    const relevantTalents = talents.filter(talent => {
      const talentLower = talent.toLowerCase();
      
      // 직접적인 재능 관련성
      if (placeTalents.some(pt => pt.toLowerCase() === talentLower)) {
        return true;
      }
      
      // 태그 관련성
      return placeTags.some(tag => 
        tag.includes(talentLower) || 
        talentLower.includes(tag) ||
        areRelatedTerms(tag, talentLower)
      );
    });
    
    if (relevantTalents.length === 0) {
      return [];
    }
    
    // 최대 2개의 재능에 대한 추천 이유 생성
    const selectedTalents = getRandomElements(relevantTalents, 2);
    
    selectedTalents.forEach(talent => {
      // 재능에 맞는 템플릿 선택
      let templates = talentReasonTemplates[talent];
      
      // 정확한 매치가 없으면 유사 재능 템플릿 찾기
      if (!templates) {
        // 일부 유사한 키워드에 대해 대체 템플릿 사용
        if (talent.includes('사진') || talent.includes('카메라'))
          templates = talentReasonTemplates['사진촬영'];
        else if (talent.includes('글') || talent.includes('작가') || talent.includes('작문'))
          templates = talentReasonTemplates['글쓰기'];
        else if (talent.includes('음악') || talent.includes('악기'))
          templates = talentReasonTemplates['음악'];
        else if (talent.includes('요리') || talent.includes('베이킹') || talent.includes('음식'))
          templates = talentReasonTemplates['요리'];
        else if (talent.includes('그림') || talent.includes('페인팅') || talent.includes('드로잉'))
          templates = talentReasonTemplates['그림'];
        else if (talent.includes('댄스') || talent.includes('춤'))
          templates = talentReasonTemplates['댄스'];
        else if (talent.includes('운동') || talent.includes('스포츠'))
          templates = talentReasonTemplates['운동'];
        else if (talent.includes('공예') || talent.includes('만들기') || talent.includes('핸드메이드'))
          templates = talentReasonTemplates['공예'];
        else if (talent.includes('연기') || talent.includes('퍼포먼스'))
          templates = talentReasonTemplates['연기'];
        else if (talent.includes('노래') || talent.includes('보컬'))
          templates = talentReasonTemplates['노래'];
        else if (talent.includes('디자인') || talent.includes('그래픽'))
          templates = talentReasonTemplates['디자인'];
        else if (talent.includes('코딩') || talent.includes('프로그래밍'))
          templates = talentReasonTemplates['코딩'];
      }
      
      // 적절한 템플릿이 없으면 기본 템플릿 생성
      if (!templates) {
        const reason = `${talent} 재능이 있는 당신이 즐기고 활용할 수 있는 장소입니다.`;
        reasons.push(reason);
      } else {
        // 템플릿에서 랜덤 선택
        const template = getRandomElement(templates);
        reasons.push(template);
      }
    });
    
    return reasons;
  } catch (error) {
    console.error('재능 추천 이유 생성 오류:', error);
    return [];
  }
};

/**
 * 감정 상태 기반 추천 이유 생성
 * 
 * @param {Object} place - 장소 정보
 * @param {Object} mood - 사용자 감정 상태
 * @returns {Array} - 감정 기반 추천 이유 배열
 */
export const generateMoodReasons = (place, mood) => {
  if (!place || !mood || !mood.mood) {
    return [];
  }
  
  try {
    const reasons = [];
    const moodType = mood.mood.toLowerCase();
    
    // 감정에 맞는 템플릿 선택
    let templates = moodReasonTemplates[moodType];
    
    // 정확한 매치가 없으면 유사 감정 템플릿 찾기
    if (!templates) {
      // 일부 유사한 키워드에 대해 대체 템플릿 사용
      if (moodType.includes('기쁨') || moodType.includes('즐거움'))
        templates = moodReasonTemplates['happy'];
      else if (moodType.includes('슬픔') || moodType.includes('우울'))
        templates = moodReasonTemplates['sad'];
      else if (moodType.includes('스트레스') || moodType.includes('불안'))
        templates = moodReasonTemplates['stressed'];
      else if (moodType.includes('설렘') || moodType.includes('기대'))
        templates = moodReasonTemplates['excited'];
      else if (moodType.includes('평온') || moodType.includes('차분'))
        templates = moodReasonTemplates['relaxed'];
      else if (moodType.includes('지루') || moodType.includes('무료'))
        templates = moodReasonTemplates['bored'];
      else if (moodType.includes('피곤') || moodType.includes('지침'))
        templates = moodReasonTemplates['tired'];
      else if (moodType.includes('배고픔') || moodType.includes('허기'))
        templates = moodReasonTemplates['hungry'];
      else if (moodType.includes('로맨틱') || moodType.includes('데이트'))
        templates = moodReasonTemplates['romantic'];
      else
        templates = moodReasonTemplates['neutral']; // 기본 템플릿
    }
    
    // 템플릿에서 최대 2개 랜덤 선택
    const selectedTemplates = getRandomElements(templates, 2);
    selectedTemplates.forEach(template => {
      reasons.push(template);
    });
    
    return reasons;
  } catch (error) {
    console.error('감정 상태 추천 이유 생성 오류:', error);
    return [];
  }
};

/**
 * 주요 추천 이유 결정
 * 
 * @param {Object} reasonAvailability - 각 카테고리별 추천 이유 존재 여부
 * @param {Object} scores - 각 카테고리별 점수
 * @param {Object} userProfile - 사용자 프로필
 * @returns {string} - 선택된 주요 추천 이유
 */
export const determinePrimaryReason = (reasonAvailability, scores, userProfile) => {
  // 점수가 가장 높은 요소 찾기
  const categories = [
    { key: 'mbti', name: 'MBTI 성향', score: scores.mbtiScore, available: reasonAvailability.mbti },
    { key: 'interests', name: '관심사', score: scores.interestScore, available: reasonAvailability.interests },
    { key: 'talents', name: '재능', score: scores.talentScore, available: reasonAvailability.talents },
    { key: 'mood', name: '현재 감정 상태', score: scores.moodScore, available: reasonAvailability.mood }
  ];
  
  // 유효한 카테고리 중 점수가 가장 높은 것 선택
  const availableCategories = categories.filter(cat => cat.available);
  
  if (availableCategories.length === 0) {
    return "이 장소가 당신에게 맞을 것 같습니다.";
  }
  
  // 점수 기준 내림차순 정렬
  availableCategories.sort((a, b) => b.score - a.score);
  
  const topCategory = availableCategories[0];
  
  // 카테고리별 주요 추천 이유 템플릿
  switch (topCategory.key) {
    case 'mbti':
      return `MBTI ${userProfile.mbti} 성향에 잘 맞는 장소입니다.`;
    case 'interests':
      if (userProfile.interests && userProfile.interests.length > 0) {
        const interest = userProfile.interests[0];
        return `${interest}에 대한 관심사와 관련된 장소입니다.`;
      }
      return "당신의 관심사와 관련된 장소입니다.";
    case 'talents':
      if (userProfile.talents && userProfile.talents.length > 0) {
        const talent = userProfile.talents[0];
        return `${talent} 재능을 활용할 수 있는 장소입니다.`;
      }
      return "당신의 재능을 발휘할 수 있는 장소입니다.";
    case 'mood':
      if (userProfile.currentMood && userProfile.currentMood.mood) {
        const mood = userProfile.currentMood.mood;
        return `현재 ${mood} 감정 상태에 적합한 장소입니다.`;
      }
      return "현재 감정 상태에 적합한 장소입니다.";
    default:
      return "이 장소가 당신에게 맞을 것 같습니다.";
  }
};

/**
 * 주요 추천 이유 생성 (외부 호출용)
 * 
 * @param {Object} matchDetails - 추천 매치 상세 점수
 * @param {Object} userProfile - 사용자 프로필
 * @returns {string} - 주요 추천 이유
 */
export const generatePrimaryReason = (matchDetails, userProfile) => {
  // 점수가 가장 높은 요소 찾기
  const categories = [
    { key: 'mbtiScore', name: 'MBTI 성향' },
    { key: 'interestScore', name: '관심사' },
    { key: 'talentScore', name: '재능' },
    { key: 'moodScore', name: '현재 감정 상태' }
  ];
  
  // 최고 점수 카테고리 찾기
  const topCategory = [...categories]
    .filter(cat => typeof matchDetails[cat.key] === 'number')
    .sort((a, b) => matchDetails[b.key] - matchDetails[a.key])[0];
  
  if (!topCategory) {
    return "당신에게 맞는 장소입니다.";
  }
  
  // 카테고리별 주요 추천 이유 템플릿
  switch (topCategory.key) {
    case 'mbtiScore':
      return `MBTI ${userProfile.mbti} 성향에 잘 맞는 장소입니다.`;
    case 'interestScore':
      return "당신의 관심사와 관련된 장소입니다.";
    case 'talentScore':
      return "당신의 재능을 활용할 수 있는 장소입니다.";
    case 'moodScore':
      if (userProfile.currentMood && userProfile.currentMood.mood) {
        const mood = userProfile.currentMood.mood;
        return `현재 ${mood} 감정 상태에 적합한 장소입니다.`;
      }
      return "현재 감정 상태에 적합한 장소입니다.";
    default:
      return "이 장소가 당신에게 맞을 것 같습니다.";
  }
};

/**
 * 장소와 사용자 관심사 간의 매치 점수 계산
 * 
 * @param {Object} place - 장소 정보
 * @param {Array} interests - 사용자 관심사 배열
 * @returns {number} - 관심사 매치 점수 (0-10)
 */
export const calculateInterestScore = (place, interests) => {
  if (!place || !interests || !Array.isArray(interests) || interests.length === 0) {
    return 0;
  }
  
  const placeTags = place.tags || [];
  if (placeTags.length === 0) {
    return 0;
  }
  
  // 관심사와 장소 태그 간 매치 수 계산
  let matches = 0;
  interests.forEach(interest => {
    const interestLower = interest.toLowerCase();
    placeTags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes(interestLower) || 
          interestLower.includes(tagLower) ||
          areRelatedTerms(tagLower, interestLower)) {
        matches++;
      }
    });
  });
  
  // 최대 10점 만점으로 정규화
  const maxPossibleMatches = Math.min(interests.length * 2, 10);
  const score = Math.min(matches, maxPossibleMatches) / maxPossibleMatches * 10;
  
  return score;
};

/**
 * 장소와 사용자 재능 간의 매치 점수 계산
 * 
 * @param {Object} place - 장소 정보
 * @param {Array} talents - 사용자 재능 배열
 * @returns {number} - 재능 매치 점수 (0-10)
 */
export const calculateTalentScore = (place, talents) => {
  if (!place || !talents || !Array.isArray(talents) || talents.length === 0) {
    return 0;
  }
  
  const placeTags = place.tags || [];
  const placeTalents = place.talentRelevance || [];
  
  if (placeTags.length === 0 && placeTalents.length === 0) {
    return 0;
  }
  
  // 재능과 장소 태그/관련 재능 간 매치 수 계산
  let matches = 0;
  talents.forEach(talent => {
    const talentLower = talent.toLowerCase();
    
    // 직접적인 재능 관련성
    placeTalents.forEach(placeTalent => {
      if (placeTalent.toLowerCase() === talentLower) {
        matches += 2; // 직접 매치는 가중치 2
      }
    });
    
    // 태그 관련성
    placeTags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      if (tagLower.includes(talentLower) || 
          talentLower.includes(tagLower) ||
          areRelatedTerms(tagLower, talentLower)) {
        matches++;
      }
    });
  });
  
  // 최대 10점 만점으로 정규화
  const maxPossibleMatches = Math.min(talents.length * 3, 10);
  const score = Math.min(matches, maxPossibleMatches) / maxPossibleMatches * 10;
  
  return score;
};

/**
 * 두 용어 간의 관련성 확인 (키워드 기반 매핑)
 * 
 * @param {string} term1 - 첫 번째 용어
 * @param {string} term2 - 두 번째 용어
 * @returns {boolean} - 관련성 여부
 */
export const areRelatedTerms = (term1, term2) => {
  // 특정 관련 용어 그룹 정의
  const relatedTermGroups = [
    ['음악', '노래', '공연', '콘서트', '밴드', '악기', '음악가'],
    ['예술', '미술', '그림', '전시', '갤러리', '아트', '작품'],
    ['음식', '요리', '맛집', '레스토랑', '식당', '베이킹', '디저트'],
    ['사진', '카메라', '촬영', '포토', '사진작가', '포토제닉'],
    ['여행', '관광', '여행지', '탐험', '투어', '방문', '트립'],
    ['책', '독서', '도서', '문학', '작가', '소설', '시'],
    ['영화', '드라마', '영상', '시네마', '영화관', '관람'],
    ['운동', '스포츠', '건강', '액티비티', '체력', '체육'],
    ['자연', '풍경', '공원', '숲', '산', '바다', '전망'],
    ['공예', '만들기', '핸드메이드', '공방', '제작', '크래프트'],
    ['디자인', '그래픽', '패션', '인테리어', '스타일', '패턴'],
    ['코딩', '프로그래밍', '개발', '기술', '소프트웨어', '컴퓨터'],
    ['게임', '놀이', '보드게임', '비디오게임', '엔터테인먼트'],
    ['댄스', '춤', '무용', '안무', '퍼포먼스'],
    ['카페', '커피', '디저트', '베이커리', '티룸']
  ];
  
  // 두 용어가 같은 관련 용어 그룹에 있는지 확인
  return relatedTermGroups.some(group => 
    group.some(keyword => term1.includes(keyword)) && 
    group.some(keyword => term2.includes(keyword))
  );
};

/**
 * 배열에서 무작위 요소 선택
 * 
 * @param {Array} array - 선택할 배열
 * @returns {*} - 선택된 무작위 요소
 */
export const getRandomElement = (array) => {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};

/**
 * 배열에서 무작위 요소들 선택
 * 
 * @param {Array} array - 선택할 배열
 * @param {number} count - 선택할 요소 수
 * @returns {Array} - 선택된 무작위 요소들
 */
export const getRandomElements = (array, count) => {
  if (!array || !Array.isArray(array) || array.length === 0) {
    return [];
  }
  
  if (array.length <= count) {
    return [...array];
  }
  
  const result = [];
  const arrayCopy = [...array];
  
  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * arrayCopy.length);
    result.push(arrayCopy[randomIndex]);
    arrayCopy.splice(randomIndex, 1);
  }
  
  return result;
};

/**
 * MBTI 유형별 색상 코드 가져오기
 * 
 * @param {string} mbtiType - MBTI 유형
 * @returns {string} - 해당 MBTI 유형의 색상 코드
 */
export const getMbtiColor = (mbtiType) => {
  return mbtiColorMap[mbtiType] || '#888888';
};

// 모듈 내보내기
const recommendationReasons = {
  generateAllReasons,
  generateMbtiReasons,
  generateInterestReasons,
  generateTalentReasons,
  generateMoodReasons,
  generatePrimaryReason,
  getMbtiColor,
  calculateInterestScore,
  calculateTalentScore
};

export default recommendationReasons;
