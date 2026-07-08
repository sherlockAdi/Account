import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';

import Loader from 'components/Loader';
import { useAuth } from 'contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();

  if (loading) return <Loader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}

ProtectedRoute.propTypes = { children: PropTypes.node };
