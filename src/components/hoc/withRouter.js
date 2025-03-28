// src/components/hoc/withRouter.js
import { useNavigate, useParams, useLocation } from 'react-router-dom';

export function withRouter(Component) {
  function ComponentWithRouterProp(props) {
    const navigate = useNavigate();
    const params = useParams();
    const location = useLocation();

    return <Component {...props} navigate={navigate} params={params} location={location} />;
  }

  return ComponentWithRouterProp;
}
