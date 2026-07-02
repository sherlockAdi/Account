// assets
import { FileSearchOutlined } from '@ant-design/icons';

// icons
const icons = {
  FileSearchOutlined
};

// ==============================|| MENU ITEMS - REPORTS ||============================== //

const reports = {
  id: 'reports',
  title: 'Reports',
  type: 'group',
  children: [
    {
      id: 'smart-reports',
      title: 'Smart Reports',
      type: 'item',
      url: '/reports',
      icon: icons.FileSearchOutlined
    }
  ]
};

export default reports;
