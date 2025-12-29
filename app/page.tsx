import { Button } from "@/components/ui/button";
import Logout from "@/module/auth/components/logout";
import { requireAuth } from "@/module/utils/auth-utils";
import Image from "next/image";
import { redirect } from "next/navigation";

export default  async function Home() {
  await requireAuth();
  return (
    // <div className="flex flex-col items-center justify-center h-screen">
    //   <Logout>
    //     <Button>Logout</Button>
    //   </Logout>
    // </div>
    redirect('/dashboard')
  )
}
