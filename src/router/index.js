import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import ZombieHuntingView from '../views/ZombieHuntingView.vue';
import FollowsManagerView from '../views/FollowsManagerView.vue';
import BackupsView from '../views/BackupsView.vue';
import ResurrectorView from '../views/ResurrectorView.vue';
import SettingsView from '../views/SettingsView.vue';
import ScoutModeView from '../views/ScoutModeView.vue';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: DashboardView,
    meta: { title: 'Dashboard - Plebs vs Zombies' }
  },
  {
    path: '/hunt',
    name: 'Hunt Zombies',
    component: ZombieHuntingView,
    meta: { title: 'Hunt Zombies - Plebs vs Zombies' }
  },
  {
    path: '/follows',
    name: 'Follows',
    component: FollowsManagerView,
    meta: { title: 'Follows - Plebs vs Zombies' }
  },
  {
    path: '/backups',
    name: 'Backups',
    component: BackupsView,
    meta: { title: 'Backups - Plebs vs Zombies' }
  },
  {
    path: '/resurrector',
    name: 'Resurrector',
    component: ResurrectorView,
    meta: { title: 'Resurrector - Plebs vs Zombies' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { title: 'Settings - Plebs vs Zombies' }
  },
  {
    path: '/scout',
    name: 'Scout',
    component: ScoutModeView,
    meta: { title: 'Scout Mode - Plebs vs Zombies' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Update document title on route change
router.afterEach((to) => {
  document.title = to.meta.title || 'Plebs vs Zombies';
});

export default router;
