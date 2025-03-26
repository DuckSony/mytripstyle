// src/components/recommendation/SaveButton.js
import React, { useState, useEffect } from 'react';
import { useSavedPlaces } from '../../contexts/SavedPlacesContext';
import { 
  Favorite as FavoriteIcon, 
  FavoriteBorder as FavoriteBorderIcon 
} from '@mui/icons-material';
import { IconButton, CircularProgress } from '@mui/material';

const SaveButton = ({ placeId, size = 'md' }) => {
  const { toggleSave, isSaved } = useSavedPlaces();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 컴포넌트 마운트 시 저장 상태 확인
  useEffect(() => {
    let isMounted = true;
    
    const checkSavedStatus = async () => {
      try {
        const status = await isSaved(placeId);
        console.log(`Place ${placeId} saved status:`, status);
        if (isMounted) {
          setSaved(status);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking saved status:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    checkSavedStatus();
    
    return () => { isMounted = false; };
  }, [placeId, isSaved]);
  
  // 저장 버튼 클릭 핸들러
  const handleToggle = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      setLoading(true);
      const newStatus = await toggleSave(placeId);
      console.log(`Toggle result for ${placeId}:`, newStatus);
      setSaved(newStatus);
    } catch (error) {
      console.error("Error toggling save:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // 디버깅용
  console.log(`Rendering SaveButton for ${placeId}: saved=${saved}, loading=${loading}`);
  
  // 크기 매핑
  const sizeMap = {
    sm: { buttonSize: 'small', iconSize: 18 },
    md: { buttonSize: 'medium', iconSize: 24 },
    lg: { buttonSize: 'large', iconSize: 30 }
  };
  
  const { buttonSize, iconSize } = sizeMap[size] || sizeMap.md;
  
  if (loading) {
    return <CircularProgress size={iconSize * 0.75} />;
  }
  
  return (
    <IconButton 
      onClick={handleToggle}
      size={buttonSize}
      aria-label={saved ? "저장 취소" : "저장하기"}
      sx={{
        padding: size === 'sm' ? '2px' : '8px',
        color: saved ? '#f44336' : 'rgba(0, 0, 0, 0.54)'
      }}
    >
      {saved ? (
        <FavoriteIcon 
          sx={{ 
            fontSize: iconSize,
            color: '#f44336'
          }} 
        />
      ) : (
        <FavoriteBorderIcon 
          sx={{ 
            fontSize: iconSize,
            color: 'rgba(0, 0, 0, 0.54)'
          }} 
        />
      )}
    </IconButton>
  );
};

export default SaveButton;
