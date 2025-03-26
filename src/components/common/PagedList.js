// src/components/common/PagedList.js
import React, { useState, useEffect, useRef } from 'react';  // useCallback 제거
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { throttle } from '../../utils/optimizationUtils';

/**
 * 페이지네이션 또는 무한 스크롤을 지원하는 목록 컴포넌트
 */
const PagedList = ({
  items = [],
  renderItem,
  pageSize = 10,
  infiniteScroll = false,
  loadingText = '로딩 중...',
  emptyText = '표시할 항목이 없습니다.',
  onPageChange,
  onLoadMore,
  loading = false,
  hasMoreItems = false,
  containerProps = {}
}) => {
  const [page, setPage] = useState(1);
  const [visibleItems, setVisibleItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const loaderRef = useRef(null);

  // 페이지네이션 모드에서 데이터 계산
  useEffect(() => {
    if (!infiniteScroll) {
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      
      setVisibleItems(items.slice(0, end));
      setTotalPages(Math.ceil(items.length / pageSize));
    }
  }, [items, page, pageSize, infiniteScroll]);

  // 무한 스크롤 모드에서는 items를 그대로 사용
  useEffect(() => {
    if (infiniteScroll) {
      setVisibleItems(items);
    }
  }, [items, infiniteScroll]);

  // 스크롤 이벤트 처리 및 등록/해제를 한 곳에서 관리
  useEffect(() => {
    if (!infiniteScroll) return;

    const handleScroll = throttle(() => {
      if (!loaderRef.current || loading || !hasMoreItems) return;

      const rect = loaderRef.current.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight + 300;
      
      if (isVisible && onLoadMore) {
        onLoadMore();
      }
    }, 200);

    window.addEventListener('scroll', handleScroll);
    
    // 초기 로드 시 한 번 호출
    handleScroll();
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [infiniteScroll, loading, hasMoreItems, onLoadMore, loaderRef]);

  // 페이지 변경 핸들러
  const handlePageChange = (newPage) => {
    setPage(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  // 아이템이 없는 경우
  if (!loading && visibleItems.length === 0) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center', 
          minHeight: '200px',
          p: 3 
        }}
      >
        <Typography color="text.secondary">{emptyText}</Typography>
      </Box>
    );
  }

  return (
    <Box {...containerProps}>
      {/* 아이템 목록 */}
      <Box>
        {visibleItems.map((item, index) => renderItem(item, index))}
      </Box>

      {/* 페이지네이션 또는 무한 스크롤 UI */}
      <Box 
        ref={loaderRef}
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          py: 3,
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {loading && (
          <Box sx={{ textAlign: 'center', my: 2 }}>
            <CircularProgress size={30} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {loadingText}
            </Typography>
          </Box>
        )}

        {!infiniteScroll && !loading && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
            >
              이전
            </Button>
            <Button 
              variant="outlined"
              disabled={page === totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              다음
            </Button>
          </Box>
        )}

        {infiniteScroll && !loading && hasMoreItems && (
          <Button 
            variant="outlined" 
            onClick={onLoadMore}
            sx={{ mt: 2 }}
          >
            더 보기
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default PagedList;
