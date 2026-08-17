import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import {
    Page,
    Container,
    Card,
    Input,
    Button,
    Typography,
    Icon
} from '@components/Components';

export const SignupPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const { signup } = useAuth();

    // Parse "Validation error: field: message, field2: message2" from server
    const parseFieldErrors = (message) => {
        if (!message) return {};
        const cleaned = message.replace(/^Validation error:\s*/i, '');
        const result = {};
        const parts = cleaned.split(/,\s*(?=[a-zA-Z][\w.]*:\s)/);
        parts.forEach(part => {
            const colonIdx = part.indexOf(': ');
            if (colonIdx !== -1) {
                const field = part.substring(0, colonIdx).trim();
                const msg = part.substring(colonIdx + 2).trim();
                result[field] = msg;
            }
        });
        return result;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear any server-side field error when user edits that field
        if (fieldErrors[name]) {
            setFieldErrors(prev => { const n = { ...prev }; delete n[name]; return n; });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setIsLoading(true);

        try {
            const signupData = { ...formData };
            delete signupData.confirmPassword;

            await signup(signupData);
            // AuthContext already called showSuccess and set the user
            navigate('/dashboard');
        } catch (error) {
            // AuthContext already showed the toast; also surface errors inline on inputs
            const parsed = parseFieldErrors(error.response?.data?.message);
            if (Object.keys(parsed).length > 0) {
                setFieldErrors(parsed);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const isFormValid =
        formData.firstName &&
        formData.lastName &&
        formData.username &&
        formData.email &&
        formData.password &&
        formData.confirmPassword;

    return (
        <Page layout="flex" align="center" justify="center">
                <Card layout="flex-column" gap="none" align="center">
                        {/* Header */}
                        <Container layout="flex-column" gap="sm" align="center">
                            <Icon name="FaUserPlus" size="lg" color="primary"/>
                            <Typography as="h1" size="2xl" weight="bold" font="secondary" color="primary">
                                Create Account
                            </Typography>
                            <Typography color="muted">
                                Join us today! Create your account to get started.
                            </Typography>
                        </Container>

                        {/* Signup Form */}
                        <Container
                          as="form"
                          layout="flex-column"
                          gap="md"
                          align="center"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              handleSubmit(e);
                            }
                          }}
                          onSubmit={handleSubmit}
                        >
                            {/* Name Fields */}
                            <Container layout="grid" columns={2} gap="xs" padding="none">
                                <Input
                                    name="firstName"
                                    variant="floating"
                                    label="First Name"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    required
                                    icon="FaUser"
                                    autoComplete="given-name"
                                    validationState={fieldErrors.firstName ? 'error' : 'default'}
                                    helpText={fieldErrors.firstName || ''}
                                />

                                <Input
                                    type="text"
                                    name="lastName"
                                    label="Last Name"
                                    variant="floating"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    required
                                    icon="FaUser"
                                    autoComplete="family-name"
                                    validationState={fieldErrors.lastName ? 'error' : 'default'}
                                    helpText={fieldErrors.lastName || ''}
                                />

                                {/* Username and Email */}
                                <Input
                                    type="text"
                                    name="username"
                                    label="Username"
                                    variant="floating"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    required
                                    icon="FaAt"
                                    autoComplete="username"
                                    validationState={fieldErrors.username ? 'error' : 'default'}
                                    helpText={fieldErrors.username || ''}
                                />

                                <Input
                                    type="email"
                                    name="email"
                                    label="Email Address"
                                    variant="floating"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    icon="FaEnvelope"
                                    autoComplete="email"
                                    validationState={fieldErrors.email ? 'error' : 'default'}
                                    helpText={fieldErrors.email || ''}
                                />
                            </Container>
                            {/* Password Fields */}
                            <Container layout="flex" gap="xs" padding="none">
                            <Input
                                type="password"
                                name="password"
                                label="Password"
                                variant="floating"
                                value={formData.password}
                                onChange={handleInputChange}
                                required
                                icon="FaLock"
                                autoComplete="new-password"
                                validationState={fieldErrors.password ? 'error' : 'default'}
                                helpText={fieldErrors.password || ''}
                            />

                            <Input
                                type="password"
                                name="confirmPassword"
                                label="Confirm Password"
                                variant="floating"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                required
                                icon="FaLock"
                                confirmField={formData.password}
                                autoComplete="new-password"
                            />
                            </Container>

                            <Button
                                type="submit"
                                color="primary"
                                disabled={!isFormValid || isLoading}
                                onClick={handleSubmit}
                                width="75%"
                            >
                                {isLoading ? (
                                    <>
                                        <Icon name="FaSpinner"/>
                                        Creating Account...
                                    </>
                                ) : (
                                    <>
                                        <Icon name="FaUserPlus"/>
                                        Create Account
                                    </>
                                )}
                            </Button>
                        </Container>

                        {/* Switch to Login */}
                        <Container layout="flex" justify="center" gap="sm">
                            <Typography size="sm">
                                Already have an account?
                            </Typography>
                            <Button
                                color="tertiary"
                                size="sm"
                                onClick={() => navigate('/login')}
                            >
                                <Icon name="FaSignInAlt"/>
                                Sign In
                            </Button>
                        </Container>
                </Card>
        </Page>
    );
};

export default SignupPage;
