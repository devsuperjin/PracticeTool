<template>
  <a-layout class="app-layout">
    <a-layout-sider :width="280" class="app-sider">
      <Sidebar />
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="app-header">
        <div class="header-tabs">
          <router-link to="/practice" class="header-tab" active-class="active">Practice</router-link>
          <router-link to="/recite" class="header-tab" active-class="active">Recite</router-link>
          <router-link to="/settings" class="header-tab" active-class="active">Settings</router-link>
        </div>
      </a-layout-header>
      <a-layout-content class="app-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import Sidebar from './components/Sidebar.vue'
import { useAppStore } from './stores/app'
import { onMounted } from 'vue'

const store = useAppStore()
onMounted(() => store.init())
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
.app-layout { height: 100vh; overflow: hidden; }
.app-sider { background: #fff; border-right: 1px solid #e5e6eb; overflow: hidden; }
.app-header {
  background: #fff; border-bottom: 1px solid #e5e6eb;
  height: 48px; display: flex; align-items: center; padding: 0;
}
.header-tabs { display: flex; height: 100%; }
.header-tab {
  padding: 0 24px; font-size: 14px; font-weight: 500; cursor: pointer;
  color: #4e5969; text-decoration: none;
  border-bottom: 2px solid transparent; transition: all .15s;
  display: flex; align-items: center;
}
.header-tab:hover { color: #165DFF; border-bottom-color: #e5e6eb; }
.header-tab.active { color: #165DFF; border-bottom-color: #165DFF; }
.app-content {
  padding: 24px 32px; overflow-y: auto;
  background: #f7f8fa; height: calc(100vh - 48px);
}
</style>
