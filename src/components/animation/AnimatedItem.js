// src/components/animation/AnimatedItem.js
import React from 'react';
import { motion } from 'framer-motion';

/**
 * 리스트 아이템 애니메이션을 제공하는 컴포넌트
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - 애니메이션을 적용할 자식 컴포넌트
 * @param {number} props.index - 리스트 내의 아이템 인덱스
 * @param {string} props.animation - 애니메이션 타입(기본값: 'fade')
 * @param {number} props.delay - 지연 시간(기본값: 0.05)
 */
const AnimatedItem = ({ 
  children, 
  index = 0, 
  animation = 'fade',
  delay = 0.05,
  ...rest 
}) => {
  // 페이드 인 애니메이션
  const fadeVariants = {
    hidden: { opacity: 0 },
    visible: i => ({
      opacity: 1,
      transition: {
        delay: i * delay,
        duration: 0.3
      }
    })
  };
  
  // 슬라이드 업 애니메이션
  const slideUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: i => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * delay,
        type: 'spring',
        stiffness: 260,
        damping: 20
      }
    })
  };
  
  // 스케일 업 애니메이션
  const scaleVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: i => ({
      opacity: 1,
      scale: 1,
      transition: {
        delay: i * delay,
        type: 'spring',
        stiffness: 200,
        damping: 15
      }
    })
  };
  
  // 슬라이드 오른쪽에서 왼쪽 애니메이션
  const slideRightVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: i => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * delay,
        type: 'spring',
        stiffness: 180,
        damping: 20
      }
    })
  };

  // 애니메이션 타입에 따른 변형 선택
  const getVariants = () => {
    switch(animation) {
      case 'slideUp':
        return slideUpVariants;
      case 'scale':
        return scaleVariants;
      case 'slideRight':
        return slideRightVariants;
      default:
        return fadeVariants;
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      custom={index}
      variants={getVariants()}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedItem;
