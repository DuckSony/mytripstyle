import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Drawer,
  Divider,
  FormControl,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Button,
  Chip,
  useMediaQuery,
  useTheme,
  Rating,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SortIcon from '@mui/icons-material/Sort';
import CloseIcon from '@mui/icons-material/Close';
import CafeIcon from '@mui/icons-material/LocalCafe';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import MuseumIcon from '@mui/icons-material/Museum';
import MenuBookIcon from '@mui/icons-material/MenuBook';

/**
 * 확장된 필터링 및 정렬 컴포넌트
 * 
 * @param {Object} props
 * @param {Object} props.filters - 현재 필터 설정
 * @param {Function} props.onFilterChange - 필터 변경 핸들러
 * @param {Boolean} props.isNearby - 내 주변 추천 여부
 * @param {Object} props.stats - 통계 정보
 */
const EnhancedFilters = ({ filters, onFilterChange, isNearby, stats = {} }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // 가장 많은 카테고리 계산
  const { categoryCount = {} } = stats;
  const mostCommonCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category]) => category);

  // 필터 적용 개수 계산
  const countActiveFilters = () => {
    let count = 0;
    
    if (filters.category && filters.category !== 'all') count++;
    if (filters.distance && filters.distance !== 'all') count++;
    if (filters.rating && filters.rating !== 'all') count++;
    if (filters.mbtiMatch && filters.mbtiMatch !== 'all') count++;
    if (filters.priceLevel && filters.priceLevel !== 'all') count++;
    
    return count;
  };

  // 필터 드로어 열기
  const handleOpenDrawer = () => {
    setDrawerOpen(true);
  };

  // 필터 드로어 닫기
  const handleCloseDrawer = () => {
    setDrawerOpen(false);
  };

  // 카테고리 필터 변경
  const handleCategoryChange = (category) => {
    onFilterChange('category', category);
    
    // 활성 필터 업데이트
    const newActiveFilters = [...activeFilters];
    const categoryIndex = newActiveFilters.findIndex(f => f.type === 'category');
    
    if (category === 'all') {
      // 카테고리 필터 제거
      if (categoryIndex !== -1) {
        newActiveFilters.splice(categoryIndex, 1);
      }
    } else {
      // 카테고리 필터 추가 또는 업데이트
      const categoryLabel = getCategoryLabel(category);
      if (categoryIndex !== -1) {
        newActiveFilters[categoryIndex] = { type: 'category', value: category, label: categoryLabel };
      } else {
        newActiveFilters.push({ type: 'category', value: category, label: categoryLabel });
      }
    }
    
    setActiveFilters(newActiveFilters);
  };

  // 거리 필터 변경
  const handleDistanceChange = (event) => {
    const distance = event.target.value;
    onFilterChange('distance', distance);
    
    // 활성 필터 업데이트
    const newActiveFilters = [...activeFilters];
    const distanceIndex = newActiveFilters.findIndex(f => f.type === 'distance');
    
    if (distance === 'all') {
      // 거리 필터 제거
      if (distanceIndex !== -1) {
        newActiveFilters.splice(distanceIndex, 1);
      }
    } else {
      // 거리 필터 추가 또는 업데이트
      const distanceLabel = getDistanceLabel(distance);
      if (distanceIndex !== -1) {
        newActiveFilters[distanceIndex] = { type: 'distance', value: distance, label: distanceLabel };
      } else {
        newActiveFilters.push({ type: 'distance', value: distance, label: distanceLabel });
      }
    }
    
    setActiveFilters(newActiveFilters);
  };

  // 평점 필터 변경
  const handleRatingChange = (event) => {
    const rating = event.target.value;
    onFilterChange('rating', rating);
    
    // 활성 필터 업데이트
    const newActiveFilters = [...activeFilters];
    const ratingIndex = newActiveFilters.findIndex(f => f.type === 'rating');
    
    if (rating === 'all') {
      // 평점 필터 제거
      if (ratingIndex !== -1) {
        newActiveFilters.splice(ratingIndex, 1);
      }
    } else {
      // 평점 필터 추가 또는 업데이트
      const ratingLabel = `${rating}점 이상`;
      if (ratingIndex !== -1) {
        newActiveFilters[ratingIndex] = { type: 'rating', value: rating, label: ratingLabel };
      } else {
        newActiveFilters.push({ type: 'rating', value: rating, label: ratingLabel });
      }
    }
    
    setActiveFilters(newActiveFilters);
  };

  // MBTI 매칭 필터 변경
  const handleMbtiMatchChange = (event) => {
    const mbtiMatch = event.target.value;
    onFilterChange('mbtiMatch', mbtiMatch);
    
    // 활성 필터 업데이트
    const newActiveFilters = [...activeFilters];
    const mbtiIndex = newActiveFilters.findIndex(f => f.type === 'mbtiMatch');
    
    if (mbtiMatch === 'all') {
      // MBTI 매칭 필터 제거
      if (mbtiIndex !== -1) {
        newActiveFilters.splice(mbtiIndex, 1);
      }
    } else {
      // MBTI 매칭 필터 추가 또는 업데이트
      let mbtiLabel;
      switch (mbtiMatch) {
        case 'high':
          mbtiLabel = 'MBTI 매칭: 높음';
          break;
        case 'medium':
          mbtiLabel = 'MBTI 매칭: 중간';
          break;
        case 'low':
          mbtiLabel = 'MBTI 매칭: 낮음';
          break;
        default:
          mbtiLabel = `MBTI 매칭: ${mbtiMatch}`;
      }
      
      if (mbtiIndex !== -1) {
        newActiveFilters[mbtiIndex] = { type: 'mbtiMatch', value: mbtiMatch, label: mbtiLabel };
      } else {
        newActiveFilters.push({ type: 'mbtiMatch', value: mbtiMatch, label: mbtiLabel });
      }
    }
    
    setActiveFilters(newActiveFilters);
  };

  // 정렬 방식 변경
  const handleSortChange = (event) => {
    onFilterChange('sortBy', event.target.value);
  };

  // 가격대 필터 변경
  const handlePriceLevelChange = (event) => {
    const priceLevel = event.target.value;
    onFilterChange('priceLevel', priceLevel);
    
    // 활성 필터 업데이트
    const newActiveFilters = [...activeFilters];
    const priceIndex = newActiveFilters.findIndex(f => f.type === 'priceLevel');
    
    if (priceLevel === 'all') {
      // 가격대 필터 제거
      if (priceIndex !== -1) {
        newActiveFilters.splice(priceIndex, 1);
      }
    } else {
      // 가격대 필터 추가 또는 업데이트
      let priceLabel;
      if (priceLevel === '1') priceLabel = '가격대: 저렴';
      else if (priceLevel === '2') priceLabel = '가격대: 보통';
      else if (priceLevel === '3') priceLabel = '가격대: 비싼';
      else priceLabel = `가격대: ${priceLevel}`;
      
      if (priceIndex !== -1) {
        newActiveFilters[priceIndex] = { type: 'priceLevel', value: priceLevel, label: priceLabel };
      } else {
        newActiveFilters.push({ type: 'priceLevel', value: priceLevel, label: priceLabel });
      }
    }
    
    setActiveFilters(newActiveFilters);
  };

  // 필터 초기화
  const handleResetFilters = () => {
    onFilterChange('category', 'all');
    onFilterChange('distance', 'all');
    onFilterChange('rating', 'all');
    onFilterChange('mbtiMatch', 'all');
    onFilterChange('priceLevel', 'all');
    setActiveFilters([]);
  };

  // 카테고리 레이블 가져오기
  const getCategoryLabel = (category) => {
    const categories = {
      cafe: '카페',
      restaurant: '식당',
      culture: '문화공간',
      bookstore_cafe: '북카페',
      bar: '바/펍',
      art_cafe: '아트카페',
      traditional_teahouse: '전통찻집'
    };
    
    return categories[category] || category;
  };

  // 카테고리 아이콘 가져오기
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'cafe':
        return <CafeIcon />;
      case 'restaurant':
        return <RestaurantIcon />;
      case 'culture':
        return <TheaterComedyIcon />;
      case 'bookstore_cafe':
        return <MenuBookIcon />;
      case 'bar':
        return <LocalBarIcon />;
      case 'art_cafe':
      case 'traditional_teahouse':
        return <MuseumIcon />;
      default:
        return null;
    }
  };

  // 거리 레이블 가져오기
  const getDistanceLabel = (distance) => {
    switch (distance) {
      case 'near':
        return '1km 이내';
      case 'medium':
        return '3km 이내';
      case 'far':
        return '5km 이내';
      default:
        return distance;
    }
  };

  // 단일 필터 제거
  const handleRemoveFilter = (filterType) => {
    onFilterChange(filterType, 'all');
    
    // 활성 필터 업데이트
    const newActiveFilters = activeFilters.filter(f => f.type !== filterType);
    setActiveFilters(newActiveFilters);
  };

  // 여기서 이전의 renderCategoryFilters 함수 제거

  return (
    <>
      {/* 필터 요약 및 필터 버튼 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            onClick={handleOpenDrawer}
            color="primary"
            size="small"
            sx={{ 
              mr: 1,
              position: 'relative',
              '&::after': countActiveFilters() > 0 ? {
                content: '""',
                position: 'absolute',
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: theme.palette.error.main
              } : {}
            }}
          >
            <FilterListIcon />
          </IconButton>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <SortIcon sx={{ fontSize: 20, mr: 0.5, color: 'text.secondary' }} />
            <FormControl component="fieldset" size="small">
              <RadioGroup
                row
                name="sortBy"
                value={filters.sortBy || 'recommendation'}
                onChange={handleSortChange}
              >
                <FormControlLabel 
                  value="recommendation" 
                  control={<Radio size="small" />} 
                  label={<Typography variant="body2">추천순</Typography>} 
                />
                <FormControlLabel 
                  value="distance" 
                  control={<Radio size="small" />} 
                  label={<Typography variant="body2">거리순</Typography>} 
                  disabled={!isNearby}
                />
                <FormControlLabel 
                  value="rating" 
                  control={<Radio size="small" />} 
                  label={<Typography variant="body2">평점순</Typography>} 
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </Box>

        {/* 활성 필터 칩 */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {activeFilters.map((filter, index) => (
            <Chip
              key={index}
              label={filter.label}
              onDelete={() => handleRemoveFilter(filter.type)}
              size="small"
              color="primary"
              variant="outlined"
            />
          ))}
          
          {activeFilters.length > 0 && (
            <Chip
              label="필터 초기화"
              onClick={handleResetFilters}
              size="small"
              color="error"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* 필터 드로어 */}
      <Drawer
        anchor={isMobile ? 'bottom' : 'right'}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        PaperProps={{
          sx: {
            width: isMobile ? '100%' : '320px',
            maxHeight: isMobile ? '80vh' : '100%',
            borderTopLeftRadius: isMobile ? 16 : 0,
            borderTopRightRadius: isMobile ? 16 : 0,
            pb: 2
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">필터 설정</Typography>
            <IconButton onClick={handleCloseDrawer} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* 드래그 핸들 (모바일) */}
          {isMobile && (
            <Box 
              sx={{ 
                width: 40, 
                height: 5, 
                backgroundColor: 'grey.300', 
                borderRadius: 2, 
                margin: '0 auto 16px' 
              }} 
            />
          )}

          {/* 카테고리 필터 */}
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">카테고리</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormGroup>
                <FormControlLabel
                  control={<Checkbox checked={filters.category === 'all'} />}
                  label="전체 카테고리"
                  onChange={() => handleCategoryChange('all')}
                />
                <Divider sx={{ my: 1 }} />
                {mostCommonCategories.map(category => (
                  <FormControlLabel
                    key={category}
                    control={
                      <Checkbox 
                        checked={filters.category === category} 
                        icon={getCategoryIcon(category)}
                        checkedIcon={getCategoryIcon(category)}
                      />
                    }
                    label={getCategoryLabel(category)}
                    onChange={() => handleCategoryChange(category)}
                  />
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>

          {/* 거리 필터 */}
          {isNearby && (
            <Accordion defaultExpanded sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">거리</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <RadioGroup
                  name="distance"
                  value={filters.distance || 'all'}
                  onChange={handleDistanceChange}
                >
                  <FormControlLabel value="all" control={<Radio />} label="모든 거리" />
                  <FormControlLabel value="near" control={<Radio />} label="1km 이내" />
                  <FormControlLabel value="medium" control={<Radio />} label="3km 이내" />
                  <FormControlLabel value="far" control={<Radio />} label="5km 이내" />
                </RadioGroup>
              </AccordionDetails>
            </Accordion>
          )}

          {/* 평점 필터 */}
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">평점</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <RadioGroup
                name="rating"
                value={filters.rating || 'all'}
                onChange={handleRatingChange}
              >
                <FormControlLabel value="all" control={<Radio />} label="모든 평점" />
                <FormControlLabel 
                  value="4" 
                  control={<Radio />} 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Rating value={4} readOnly size="small" sx={{ mr: 1 }} />
                      <Typography variant="body2">이상</Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value="3" 
                  control={<Radio />} 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Rating value={3} readOnly size="small" sx={{ mr: 1 }} />
                      <Typography variant="body2">이상</Typography>
                    </Box>
                  } 
                />
              </RadioGroup>
            </AccordionDetails>
          </Accordion>

          {/* MBTI 매칭 필터 */}
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">MBTI 매칭도</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <RadioGroup
                name="mbtiMatch"
                value={filters.mbtiMatch || 'all'}
                onChange={handleMbtiMatchChange}
              >
                <FormControlLabel value="all" control={<Radio />} label="모든 매칭도" />
                <FormControlLabel value="high" control={<Radio />} label="높음 (8점 이상)" />
                <FormControlLabel value="medium" control={<Radio />} label="중간 (5점 이상)" />
              </RadioGroup>
            </AccordionDetails>
          </Accordion>

          {/* 가격대 필터 */}
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">가격대</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <RadioGroup
                name="priceLevel"
                value={filters.priceLevel || 'all'}
                onChange={handlePriceLevelChange}
              >
                <FormControlLabel value="all" control={<Radio />} label="모든 가격대" />
                <FormControlLabel 
                  value="1" 
                  control={<Radio />} 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ mr: 0.5 }}>저렴함</Typography>
                      <Typography variant="body2" color="text.secondary">￦</Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value="2" 
                  control={<Radio />} 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ mr: 0.5 }}>보통</Typography>
                      <Typography variant="body2" color="text.secondary">￦￦</Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value="3" 
                  control={<Radio />} 
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ mr: 0.5 }}>비쌈</Typography>
                      <Typography variant="body2" color="text.secondary">￦￦￦</Typography>
                    </Box>
                  } 
                />
              </RadioGroup>
            </AccordionDetails>
          </Accordion>

          {/* 버튼 */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button 
              variant="outlined" 
              color="error" 
              onClick={handleResetFilters}
              disabled={activeFilters.length === 0}
            >
              필터 초기화
            </Button>
            <Button variant="contained" onClick={handleCloseDrawer}>
              적용하기
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default EnhancedFilters;
