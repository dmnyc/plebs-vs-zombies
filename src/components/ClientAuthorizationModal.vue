<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" @click="handleBackdropClick">
    <div class="bg-zinc-900 border border-gray-600 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl" @click.stop>
      <!-- Header -->
      <div class="text-center mb-6">
        <h2 class="text-white text-xl font-semibold">Permission request</h2>
      </div>
      
      <!-- App Info -->
      <div class="flex items-center mb-6">
        <!-- App Logo -->
        <div class="w-12 h-12 bg-white rounded-lg flex items-center justify-center mr-4 p-2">
          <img 
            :src="appInfo.logo" 
            :alt="appInfo.name + ' logo'"
            class="w-full h-full object-contain"
            @error="onLogoError"
          />
        </div>
        
        <!-- App Details -->
        <div class="flex-1">
          <h3 class="text-white font-medium text-lg">{{ appInfo.name }}</h3>
          <p class="text-gray-400 text-sm font-mono">{{ appInfo.pubkey }}</p>
        </div>
      </div>
      
      <!-- Permission Details -->
      <div class="mb-6">
        <div class="bg-gray-800 rounded-lg p-3 mb-4">
          <h4 class="text-gray-300 font-medium mb-2">ACTION</h4>
          <p class="text-white">Client Authentication</p>
        </div>
        
        <!-- Remember Decision -->
        <label class="flex items-center text-gray-300 cursor-pointer">
          <input 
            v-model="rememberDecision" 
            type="checkbox" 
            class="mr-3 w-4 h-4 text-zombie-green bg-gray-700 border-gray-600 rounded focus:ring-zombie-green focus:ring-2"
          />
          Remember my decision
        </label>
      </div>
      
      <!-- Action Buttons -->
      <div class="flex space-x-3">
        <button 
          @click="handleDeny"
          class="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
        >
          Disallow Always
        </button>
        <button 
          @click="handleAllow"
          class="flex-1 px-4 py-3 bg-zombie-green text-zombie-dark rounded-lg hover:bg-green-400 transition-colors font-medium"
        >
          Allow Always
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ClientAuthorizationModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    appInfo: {
      type: Object,
      default: () => ({
        name: 'Unknown App',
        pubkey: '',
        logo: '/logo.svg',
        url: ''
      })
    }
  },
  data() {
    return {
      rememberDecision: false
    };
  },
  methods: {
    handleAllow() {
      this.$emit('allow', {
        remember: this.rememberDecision
      });
      this.rememberDecision = false;
    },
    handleDeny() {
      this.$emit('deny', {
        remember: this.rememberDecision
      });
      this.rememberDecision = false;
    },
    handleBackdropClick() {
      // Close modal by denying the request
      this.handleDeny();
    },
    onLogoError() {
      // Fallback to default logo if app logo fails to load
      this.appInfo.logo = '/logo.svg';
    }
  }
};
</script>