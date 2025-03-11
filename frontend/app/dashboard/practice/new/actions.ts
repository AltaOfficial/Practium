"use server";

import { supabase } from "@/utils/supabase/server";
import { auth } from "@clerk/nextjs/server";

export async function createNewCourse(courseFormData: FormData) {
  const { userId } = await auth();
  const urls = [];
  const websiteUrls = (courseFormData.get("urls") as string).split(",");
  if (websiteUrls[0] != "") {
    urls.push(websiteUrls);
  }
  for (let imageOrPdfFile of courseFormData.getAll("uploadedFiles") as File[]) {
    if (imageOrPdfFile.size != 0) {
      let { data: uploadedFileData } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET_NAME!)
        .upload(imageOrPdfFile.name, imageOrPdfFile);

      const filePublicUrl = supabase.storage
        .from(process.env.SUPABASE_BUCKET_NAME!)
        .getPublicUrl(uploadedFileData?.path!).data.publicUrl;

      urls.push(filePublicUrl);
    }
  }

  let res = await supabase.from("courses").insert({
    name: courseFormData.get("courseName") as string,
    user_id: userId,
    urls_to_grade_with: urls.length > 0 ? urls : null,
  });
  console.log(res);
}
