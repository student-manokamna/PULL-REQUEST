import LoginUI from '@/module/auth/components/login-ui'
import { requireunAuth } from '@/module/utils/auth-utils'
import React from 'react'

const LoginPage  = async () => {
    await requireunAuth();
  return (
    <div>
      <LoginUI/>
    </div>
  )
}

export default LoginPage 

