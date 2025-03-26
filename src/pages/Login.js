// src/pages/Login.js
import React, { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Link,
  Divider,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Google as GoogleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const { login, loginWithGoogle, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 리디렉션 경로 (이전 페이지 또는 홈)
  const from = location.state?.from?.pathname || '/';
  
  // 이메일 변경 핸들러
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
  };
  
  // 비밀번호 변경 핸들러
  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setError('');
  };
  
  // 비밀번호 표시 토글
  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  // 로그인 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      const result = await login(email, password);
      
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || '로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error('로그인 오류:', err);
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };
  
  // Google 로그인 핸들러
  const handleGoogleLogin = async () => {
    try {
      setError('');
      setLoading(true);
      
      const result = await loginWithGoogle();
      
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Google 로그인에 실패했습니다.');
      }
    } catch (err) {
      console.error('Google 로그인 오류:', err);
      setError('Google 로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };
  
  // 비밀번호 재설정 이메일 전송 핸들러
  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError('비밀번호 재설정을 위해 이메일을 입력해주세요.');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      const result = await resetPassword(email);
      
      if (result.success) {
        setResetEmailSent(true);
      } else {
        setError(result.error || '비밀번호 재설정 이메일 전송에 실패했습니다.');
      }
    } catch (err) {
      console.error('비밀번호 재설정 오류:', err);
      setError('비밀번호 재설정 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            로그인
          </Typography>
          <Typography variant="body2" color="text.secondary">
            MyTripStyle 서비스를 이용하려면 로그인해주세요.
          </Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {resetEmailSent && (
          <Alert severity="success" sx={{ mb: 3 }}>
            비밀번호 재설정 이메일이 발송되었습니다. 이메일을 확인해주세요.
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <TextField
            label="이메일"
            type="email"
            value={email}
            onChange={handleEmailChange}
            fullWidth
            required
            margin="normal"
            variant="outlined"
            autoComplete="email"
            InputProps={{
              autoComplete: 'email'
            }}
          />
          
          <TextField
            label="비밀번호"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={handlePasswordChange}
            fullWidth
            required
            margin="normal"
            variant="outlined"
            autoComplete="current-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleTogglePasswordVisibility}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
              autoComplete: 'current-password'
            }}
          />
          
          <Box sx={{ mt: 1, textAlign: 'right' }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={handlePasswordReset}
              underline="hover"
            >
              비밀번호를 잊으셨나요?
            </Link>
          </Box>
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3, mb: 2, py: 1.5 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : '로그인'}
          </Button>
          
          <Divider sx={{ my: 3 }}>또는</Divider>
          
          <Button
            fullWidth
            variant="outlined"
            size="large"
            sx={{ mb: 2, py: 1.5 }}
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            Google 계정으로 로그인
          </Button>
          
          <Grid container justifyContent="center" sx={{ mt: 3 }}>
            <Grid item>
              <Typography variant="body2">
                계정이 없으신가요?{' '}
                <Link component={RouterLink} to="/register" underline="hover">
                  회원가입
                </Link>
              </Typography>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Container>
  );
};

export default Login;
