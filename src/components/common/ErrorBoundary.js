// src/components/common/ErrorBoundary.js
import React, { Component } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';
import { RefreshRounded, Home } from '@mui/icons-material';
import { withRouter } from '../hoc/withRouter'; // 라우터 props를 받기 위한 HOC

class ErrorBoundary extends Component {
  state = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error) {
    // 다음 렌더링에서 대체 UI를 표시하기 위해 상태를 업데이트합니다
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 에러 리포팅 서비스에 에러를 기록할 수 있습니다
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
    
    // 개발 환경에서는 콘솔에 상세 정보 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('컴포넌트 스택:', errorInfo.componentStack);
    }
  }

  handleRetry = () => {
    // 페이지 새로고침
    window.location.reload();
  };

  handleGoHome = () => {
    // 홈으로 이동
    this.props.navigate('/');
  };

  render() {
    if (this.state.hasError) {
      // 대체 UI
      return (
        <Container maxWidth="sm">
          <Box
            sx={{
              mt: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              p: 3,
              borderRadius: 2,
              bgcolor: 'background.paper',
              boxShadow: 1,
            }}
          >
            <Typography variant="h5" color="error" gutterBottom>
              문제가 발생했습니다
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              페이지를 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshRounded />}
                onClick={this.handleRetry}
                sx={{ minWidth: '120px' }}
              >
                다시 시도
              </Button>
              <Button
                variant="outlined"
                startIcon={<Home />}
                onClick={this.handleGoHome}
                sx={{ minWidth: '120px' }}
              >
                홈으로 이동
              </Button>
            </Box>
          </Box>
        </Container>
      );
    }

    // 오류가 없으면 자식 컴포넌트를 정상적으로 렌더링
    return this.props.children;
  }
}

export default withRouter(ErrorBoundary);
