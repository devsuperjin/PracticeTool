import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: () => {
      const dv = localStorage.getItem('defaultView') || 'practice'
      return `/${dv}`
    }
  },
  { path: '/practice', name: 'practice', component: () => import('../views/PracticeView.vue') },
  { path: '/recite', name: 'recite', component: () => import('../views/ReciteView.vue') },
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
