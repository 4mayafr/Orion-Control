import type { Metadata } from 'next';
import { Fragment } from 'react';
import { Check, Minus, ShieldCheck } from 'lucide-react';
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  resolvePermissions,
} from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';
import { toUserDTO } from '@/lib/dto';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/primitives';
import { OperatorsManager } from '@/components/operators/operators-manager';

export const metadata: Metadata = { title: 'Operators' };

export default async function OperatorsPage() {
  const currentUser = await requirePageUser('operators.view');
  const store = await getStore();
  const users = await store.listUsers();
  const items = await Promise.all(
    users.map(async (user) => {
      const overrides = await store.getUserPermissions(user.id);
      return toUserDTO(user, resolvePermissions(user.role, overrides), overrides);
    }),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Operators"
        description="Accounts, roles and granular permissions. Every API route and page re-checks permissions on the server — hiding a button is never the control."
      />

      <OperatorsManager
        initialOperators={items}
        currentUserId={currentUser.id}
        canManage={currentUser.permissions.includes('operators.manage')}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Role model" icon={<ShieldCheck size={16} />} />
          <CardBody className="space-y-3">
            {ROLES.map((role) => (
              <div key={role} className="rounded-lg border border-edge/70 bg-void-850/40 p-3">
                <p className="text-[13px] font-medium text-slate-200">{ROLE_LABELS[role]}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Permission matrix"
            description="Default grants per role. Operators can be adjusted with overrides."
          />
          <div className="table-wrap">
            <table className="data-table min-w-[560px]">
              <thead>
                <tr>
                  <th>Permission</th>
                  {ROLES.map((role) => (
                    <th key={role} className="text-center">
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <Fragment key={group.label}>
                    <tr>
                      <td
                        colSpan={ROLES.length + 1}
                        className="bg-void-850/40 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                      >
                        {group.label}
                      </td>
                    </tr>
                    {group.permissions.map((permission) => (
                      <tr key={permission}>
                        <td>
                          <span className="text-[12px] text-slate-300">
                            {PERMISSION_LABELS[permission]}
                          </span>
                          <span className="mono ml-1 block text-[10px] text-slate-600">
                            {permission}
                          </span>
                        </td>
                        {ROLES.map((role) => (
                          <td key={role} className="text-center">
                            {ROLE_PERMISSIONS[role].includes(permission) ? (
                              <Check size={14} className="mx-auto text-signal-success" />
                            ) : (
                              <Minus size={14} className="mx-auto text-slate-700" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
