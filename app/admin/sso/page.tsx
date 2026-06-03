import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export default async function SSOGroupMappingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ data: mappings }, { data: classes }] = await Promise.all([
    supabase.from("azure_group_mappings").select("*").order("group_name"),
    supabase.from("classes").select("id, name").order("name"),
  ]);

  async function addMapping(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("azure_group_mappings").insert({
      group_object_id: (formData.get("group_object_id") as string).trim(),
      group_name:      (formData.get("group_name") as string).trim(),
      role:            formData.get("role") as string,
      class_id:        (formData.get("class_id") as string) || null,
    });
    revalidatePath("/admin/sso");
  }

  async function deleteMapping(formData: FormData) {
    "use server";
    const supabase = createClient();
    await supabase.from("azure_group_mappings")
      .delete().eq("id", formData.get("id") as string);
    revalidatePath("/admin/sso");
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="h-display text-2xl text-gold">Microsoft SSO — Group Mappings</h1>
        <p className="text-sm text-ink/60 mt-2">
          Map Entra ID group Object IDs to roles and classes. Students sign in with
          Microsoft and are automatically enrolled in their year group's class.
          Get Object IDs from <strong>Azure Portal → Entra ID → Groups → [group] → Overview</strong>.
        </p>
      </div>

      {/* Existing mappings */}
      <section className="card p-5">
        <h2 className="font-semibold mb-4">Current mappings</h2>
        {!mappings?.length ? (
          <p className="text-sm text-ink/50">No mappings yet. Add one below.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-ink/10">
                <th className="pb-2 font-normal">Group name</th>
                <th className="pb-2 font-normal">Object ID</th>
                <th className="pb-2 font-normal">Role</th>
                <th className="pb-2 font-normal">Class</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {mappings.map((m: any) => (
                <tr key={m.id}>
                  <td className="py-2 font-medium">{m.group_name}</td>
                  <td className="py-2 font-mono text-xs text-ink/60">{m.group_object_id}</td>
                  <td className="py-2">
                    <span className={`chip-${m.role === 'admin' ? 'wine' : m.role === 'teacher' ? 'sky' : 'gold'}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="py-2 text-ink/70">
                    {classes?.find((c: any) => c.id === m.class_id)?.name ?? <span className="text-ink/30">—</span>}
                  </td>
                  <td className="py-2 text-right">
                    <form action={deleteMapping}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="text-xs text-wine hover:underline">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Add mapping */}
      <section className="card p-5">
        <h2 className="font-semibold mb-4">Add mapping</h2>
        <form action={addMapping} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink/50 block mb-1">Group name (label)</label>
              <input name="group_name" className="input w-full" placeholder="e.g. Year 9 Latin" required />
            </div>
            <div>
              <label className="text-xs text-ink/50 block mb-1">Entra Object ID</label>
              <input name="group_object_id" className="input w-full font-mono text-sm"
                     placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink/50 block mb-1">Role</label>
              <select name="role" className="input w-full">
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-ink/50 block mb-1">Auto-enrol in class (optional)</label>
              <select name="class_id" className="input w-full">
                <option value="">— none —</option>
                {classes?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn-primary">Add mapping</button>
        </form>
      </section>
    </div>
  );
}
