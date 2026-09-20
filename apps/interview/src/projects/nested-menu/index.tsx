import { MenuList } from './components/menu-list';
import { PagePanel } from './components/page-panel';
import { ROLES } from './constants/nested-menu.constants';
import { useNestedMenu } from './hooks/use-nested-menu';
import './nested-menu.css';

export default function NestedMenuPage() {
  const menu = useNestedMenu();

  return (
    <section className="nm">
      <div className="nm__toolbar">
        <label className="nm__field">
          Role
          <select value={menu.roleId} onChange={(event) => menu.changeRole(event.target.value)}>
            {ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <form
          className="nm__address"
          onSubmit={(event) => {
            event.preventDefault();
            menu.navigate(menu.routeInput);
          }}
        >
          <label className="nm__field">
            Go to
            <input
              value={menu.routeInput}
              onChange={(event) => menu.setRouteInput(event.target.value)}
              spellCheck={false}
            />
          </label>
          <button type="submit" className="nm__btn">
            Navigate
          </button>
        </form>
      </div>

      <div className="nm__layout">
        <nav className="nm__nav" aria-label="Product navigation">
          <MenuList
            nodes={menu.tree}
            depth={0}
            openSet={menu.openSet}
            activeId={menu.activeId}
            activeTrail={menu.activeTrail}
            focusId={menu.focusId}
            onActivate={menu.activate}
            onKeyDown={menu.onItemKeyDown}
            onFocus={menu.onItemFocus}
            registerItem={menu.registerItem}
          />
        </nav>
        <PagePanel route={menu.route} breadcrumb={menu.breadcrumb} />
      </div>
    </section>
  );
}
