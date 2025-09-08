<template>
  <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="handleBackdropClick">
    <div class="bg-zombie-dark border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
      <div class="flex items-center mb-4">
        <div 
          class="w-8 h-8 rounded-full flex items-center justify-center mr-3"
          :class="{
            'bg-blue-600': type === 'info',
            'bg-red-600': type === 'error',
            'bg-zombie-green': type === 'success',
            'bg-yellow-600': type === 'warning'
          }"
        >
          <span v-if="type === 'info'">ℹ️</span>
          <span v-else-if="type === 'error'">❌</span>
          <span v-else-if="type === 'success'">✅</span>
          <span v-else-if="type === 'warning'">⚠️</span>
        </div>
        <h3 
          class="text-lg font-medium"
          :class="{
            'text-blue-400': type === 'info',
            'text-red-400': type === 'error',
            'text-zombie-green': type === 'success',
            'text-yellow-400': type === 'warning'
          }"
        >
          {{ title }}
        </h3>
      </div>
      
      <p class="text-gray-300 mb-6 whitespace-pre-wrap">{{ message }}</p>
      
      <div class="flex justify-end space-x-3">
        <button 
          @click="handleCancel"
          class="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
        >
          {{ cancelText }}
        </button>
        <button 
          @click="handleConfirm"
          class="px-4 py-2 rounded transition-colors"
          :class="{
            'bg-blue-600 hover:bg-blue-500 text-white': type === 'info',
            'bg-red-600 hover:bg-red-500 text-white': type === 'error',
            'bg-zombie-green hover:bg-green-500 text-zombie-dark': type === 'success',
            'bg-yellow-600 hover:bg-yellow-500 text-black': type === 'warning'
          }"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConfirmModal',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: 'Confirm'
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      default: 'warning',
      validator: value => ['info', 'success', 'warning', 'error'].includes(value)
    },
    confirmText: {
      type: String,
      default: 'OK'
    },
    cancelText: {
      type: String,
      default: 'Cancel'
    }
  },
  methods: {
    handleConfirm() {
      this.$emit('confirm');
    },
    handleCancel() {
      this.$emit('cancel');
    },
    handleBackdropClick() {
      // Optional: close on backdrop click (same as cancel)
      this.$emit('cancel');
    }
  }
};
</script>