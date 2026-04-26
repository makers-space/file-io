import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { useNotification } from '@contexts/NotificationContext';
import { 
  Page, 
  Container, 
  Card, 
  Input, 
  Button, 
  Typography, 
  Icon 
} from '@components/Components';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [shakeSignup, setShakeSignup] = useState(false);
  const { login } = useAuth();
  const { error: showError, success: showSuccess } = useNotification();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Simple validation - just check if fields are filled
    if (!formData.identifier || !formData.password) {
      if (!formData.identifier) {
        showError('Email or username is required');
      } else if (!formData.password) {
        showError('Password is required');
      }
      return;
    }
    
    setIsLoading(true);

    try {
      const result = await login(formData);
      
      if (result.success) {
        showSuccess('Login successful! Welcome back.');
        navigate('/dashboard');
      } else {
        showError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      const serverMsg = error.response?.data?.message || error.message || '';
      if (serverMsg === 'Invalid credentials') {
        showError('No account found with those details. Check your info or sign up below!');
        setShakeSignup(true);
        setTimeout(() => setShakeSignup(false), 600);
      } else {
        showError(serverMsg || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = formData.identifier && formData.password;

  return (
    <Page layout="flex" align="center" justify="center">
        <Card layout="flex-column" padding="xl" align="center" gap="lg" >
            {/* Header */}
            <Container layout="flex-column" gap="sm" align="center" padding="none">
              <Icon name="FaLock" size="lg" color="primary" />
              <Typography as="h1" size="2xl" weight="bold" color="primary">
                Sign In
              </Typography>
              <Typography align="center">
                Welcome back! Please sign in to your account.
              </Typography>
            </Container>

            {/* Login Form */}
              <Container
                as="form"
                style={{ width: '80%' }}
                gap="md"
                padding="none"
                onSubmit={handleSubmit}
              >
                <Input
                  type="text"
                  name="identifier"
                  label="Email or Username"
                  variant="floating"
                  value={formData.identifier}
                  onChange={handleInputChange}
                  required
                  width="100%"
                  autoComplete="username"
                />

                <Input
                  type="password"
                  name="password"
                  label="Password"
                  variant="floating"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  width="100%"
                  autoComplete="current-password"
                />

                <Button
                  type="submit"
                  color="primary"
                  disabled={!isFormValid || isLoading}
                  width="100%"
                >
                  {isLoading ? (
                    <>
                      <Icon name="FaSpinner" />
                      Signing In...
                    </>
                  ) : (
                    <>
                      <Icon name="FaSignInAlt" />
                      Sign In
                    </>
                  )}
                </Button>
              </Container>

            {/* Actions */}
            <Container layout="flex-column" gap="sm" align="center" padding="none">
              <Button
                color="secondary"
                size="sm"
                onClick={() => navigate('/forgot-password')}
              >
                Forgot your password?
              </Button>

              <Container layout="flex" justify="center" gap="sm">
                <Typography size="sm">
                  Don't have an account?
                </Typography>
                <Button
                  color="tertiary"
                  size="sm"
                  onClick={() => navigate('/signup')}
                  style={shakeSignup ? { animation: 'shake 0.5s ease-in-out' } : undefined}
                >
                  Sign Up
                </Button>
              </Container>
            </Container>
        </Card>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 50%, 90% { transform: translateX(-4px); }
            30%, 70% { transform: translateX(4px); }
          }
        `}</style>
    </Page>
  );
};

export default LoginPage;
